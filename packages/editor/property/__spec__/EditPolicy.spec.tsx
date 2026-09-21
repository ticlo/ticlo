import React from 'react';
import {flushSync} from 'react-dom';
import {simulate} from 'simulate-event';
import {Block, Root, blankFuncDesc, type ClientConn, type EditPolicy, type PropGroupDesc} from '@ticlo/core';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {globalFunctions} from '@ticlo/core/block/FunctionLib.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {EditPolicyProvider} from '../../component/EditPolicyContext.tsx';
import {initEditor} from '../../index.ts';
import {PropertyEditor} from '../PropertyEditor.tsx';
import {BlockStage} from '../../block/BlockStage.tsx';
import {BlockView} from '../../block/Block.tsx';
import {FieldView} from '../../block/Field.tsx';
import {CustomGroupPropertyReorder} from '../PropertyReorder.ts';
import {WorkerEditor} from '../value/WorkerEditor.tsx';
import {DragState} from 'rc-dock';
import {loadTemplate, removeLastTemplate, fakeMouseEvent} from '../../util/test-util.ts';

function loadPolicyTemplate(
  initial: ClientConn,
  setConnection: (conn: ClientConn) => void,
  render: () => React.ReactNode,
  style: string
): [(policy?: EditPolicy) => void, HTMLDivElement] {
  let redraw: () => void;
  function Template() {
    [, redraw] = React.useReducer((value: number) => value + 1, 0);
    return render();
  }
  const [, div] = loadTemplate(<Template />, style);
  return [
    (policy) =>
      flushSync(() => {
        setConnection(initial.getBaseConn().withPolicy(policy));
        redraw();
      }),
    div,
  ];
}

describe('editor EditPolicy', () => {
  beforeEach(async () => {
    await initEditor();
    Root.instance.addFlow('PolicyUI', {
      add: {'#is': 'add', '0': 1, '1': 2, '@b-xyw': [100, 100, 200], '@b-p': ['0', '1']},
      other: {'#is': 'add', '0': 1, '1': 2},
    });
  });

  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue('PolicyUI');
  });

  for (const mode of ['client', 'server'] as const) {
    it(`updates multi-selected property inputs from ${mode} limits`, async () => {
      const [server, base] = makeLocalConnection(Root.instance);
      let client: ClientConn = base;
      const [desc] = globalFunctions.getDescToSend('add');
      const prop = (desc.properties[0] as PropGroupDesc).properties[0];
      let editor: PropertyEditor;
      const [replacePolicy, div] = loadPolicyTemplate(
        client,
        (next) => {
          client = next;
        },
        () => (
          <EditPolicyProvider conn={client}>
            <PropertyEditor
              ref={(value) => {
                editor = value;
              }}
              conn={client}
              paths={['PolicyUI.add', 'PolicyUI.other']}
              name="0"
              funcDesc={desc}
              propDesc={prop}
            />
          </EditPolicyProvider>
        ),
        'editor'
      );
      const input = () => div.querySelector('input') as HTMLInputElement;
      await shouldHappen(() => input() && !input().disabled);
      const setPolicy = mode === 'client' ? replacePolicy : server.setEditPolicy.bind(server);
      setPolicy({allowPaths: ['PolicyUI.add.**'], readonlyPaths: ['**']});
      await shouldHappen(() => input().disabled);
      expect(div.querySelector('.ticl-property-readonly')).not.toBeNull();
      setPolicy({allowProps: ['0']});
      await shouldHappen(() => !input().disabled);
      setPolicy({allowProps: [], denyProps: ['0'], allowBinding: ['0']});
      await shouldHappen(() => input().disabled);
      expect(editor.canBind()).toBe(true);
      setPolicy({denyCmds: ['set']});
      await shouldHappen(() => input().disabled);
      setPolicy(undefined);
      await shouldHappen(() => !input().disabled);
    });
  }

  it('shows only the client policy and switches to the server policy when it is cleared', async () => {
    const [server, base] = makeLocalConnection(Root.instance, true, {allowCmds: []});
    let client: ClientConn = base.withPolicy({allowProps: ['0']});
    const [desc] = globalFunctions.getDescToSend('add');
    const prop = (desc.properties[0] as PropGroupDesc).properties[0];
    const [replacePolicy, div] = loadPolicyTemplate(
      client,
      (next) => {
        client = next;
      },
      () => (
        <EditPolicyProvider conn={client}>
          <PropertyEditor conn={client} paths={['PolicyUI.add']} name="0" funcDesc={desc} propDesc={prop} />
        </EditPolicyProvider>
      ),
      'editor'
    );
    const input = () => div.querySelector('input') as HTMLInputElement;
    await shouldHappen(() => input() && !input().disabled);
    replacePolicy(undefined);
    await shouldHappen(() => input().disabled);
    server.setEditPolicy({allowProps: ['0']});
    await shouldHappen(() => !input().disabled);
    replacePolicy({allowProps: []});
    await shouldHappen(() => input().disabled);
    replacePolicy({});
    await shouldHappen(() => !input().disabled);
  });

  it('keeps selection and zoom available while blocking stage edits', async () => {
    const [server, base] = makeLocalConnection(Root.instance);
    let client: ClientConn = base.withPolicy({allowCmds: []});
    let stage: BlockStage;
    let selection: string[];
    const [replacePolicy, div] = loadPolicyTemplate(
      client,
      (next) => {
        client = next;
      },
      () => (
        <EditPolicyProvider conn={client}>
          <BlockStage
            ref={(value) => {
              stage = value;
            }}
            conn={client}
            basePath="PolicyUI"
            onSelect={(paths) => {
              selection = paths;
            }}
            style={{width: 800, height: 600}}
          />
        </EditPolicyProvider>
      ),
      'editor'
    );
    await shouldHappen(() => stage?.getBlock('PolicyUI.add')?.descLoaded);
    const originalStage = stage;
    const blockItem = stage.getBlock('PolicyUI.add');
    let block: HTMLElement;
    await shouldHappen(() => {
      block = div.querySelector('.ticl-stage-scroll .ticl-block');
      return block?.offsetLeft === 100;
    });
    simulate(block.querySelector('.ticl-block-head'), 'mousedown', fakeMouseEvent());
    simulate(document.body, 'mousemove', fakeMouseEvent(100, 100));
    simulate(document.body, 'mouseup');
    expect(selection).toEqual(['PolicyUI.add']);
    expect(stage.isDraggingBlock()).toBe(false);
    expect(block.offsetLeft).toBe(100);
    expect(stage.deleteSelection()).toBe(false);
    expect(stage.undo()).toBe(true);
    expect(stage.redo()).toBe(true);
    await stage.createBlock('blocked', {'#is': 'add'}, false);
    expect(Root.instance.queryValue('PolicyUI.blocked')).toBeUndefined();
    const requestIds = Object.keys(server.requests);
    replacePolicy({allowCreateBlock: false, allowDeleteBlock: false, allowChangeBlockType: false});
    await shouldHappen(() => client.getEditPolicyView().canWriteField('PolicyUI.add.0'));
    expect(stage).toBe(originalStage);
    expect(stage.getBlock('PolicyUI.add')).toBe(blockItem);
    expect(blockItem.selected).toBe(true);
    expect(blockItem.conn).toBe(client);
    expect(block.isConnected).toBe(true);
    expect(Object.keys(server.requests)).toEqual(requestIds);
    await stage.createBlock('blocked', {'#is': 'add'}, false);
    expect(Root.instance.queryValue('PolicyUI.blocked')).toBeUndefined();
    expect(stage.deleteSelection()).toBe(false);
    replacePolicy({allowPaths: ['PolicyUI.blocked', 'PolicyUI.blocked.**']});
    const create = vi.spyOn(client, 'addBlock');
    await stage.createBlock('blocked', {'#is': 'add'}, false);
    expect(create).not.toHaveBeenCalled();
    create.mockRestore();
    replacePolicy({allowBlockTypes: ['add']});
    await stage.createBlock('wrongType', {'#is': 'subtract'}, false);
    expect(Root.instance.queryValue('PolicyUI.wrongType')).toBeUndefined();
    await stage.createBlock('allowed', {'#is': 'add'}, false);
    expect(Root.instance.queryValue('PolicyUI.allowed')).toBeDefined();
    // Let the new block's subscriptions finish before teardown disconnects the client.
    await shouldHappen(() => stage.getBlock('PolicyUI.allowed')?.descLoaded);
  });

  it.each([
    {policy: {}, allowed: true},
    {policy: {denyProps: ['#sync']}, allowed: false},
    {policy: {allowBinding: []}, allowed: false},
  ])('checks sync permissions when starting a block drag: $policy', async ({policy, allowed}) => {
    const [, base] = makeLocalConnection(Root.instance);
    const client = base.withPolicy(policy);
    let stage: BlockStage;
    loadTemplate(
      <EditPolicyProvider conn={client}>
        <BlockStage
          ref={(value) => {
            stage = value;
          }}
          conn={client}
          basePath="PolicyUI"
        />
      </EditPolicyProvider>,
      'editor'
    );
    await shouldHappen(
      () => stage?.getBlock('PolicyUI.add')?.w === 200 && stage.getBlock('PolicyUI.other')?.descLoaded
    );
    const source = stage.getBlock('PolicyUI.add');
    const target = stage.getBlock('PolicyUI.other');
    const sourceView = [...source._renderers][0] as BlockView;
    const targetView = [...target._renderers][0] as BlockView;
    const event = new DragState({type: 'mousedown', ctrlKey: false} as MouseEvent, {dragType: 'left'} as any, true);
    const start = vi.spyOn(event, 'startDrag').mockImplementation(() => {});
    try {
      sourceView.selectAndDrag(event);
      expect(start).toHaveBeenCalledOnce();
      targetView.onDragOverFoot(event);
      expect(event.acceptMessage === '').toBe(allowed);
      if (allowed) {
        targetView.onDropFoot(event);
      }
      sourceView.onDragEnd(event);
      if (!allowed) {
        expect(source._syncParent).toBeFalsy();
        // Start a separate drag with an existing sync link.
        Root.instance.queryProperty('PolicyUI.add.@b-xyw').setValue('other');
      }
      await shouldHappen(() => source._syncParent === target);
      start.mockClear();
      sourceView.selectAndDrag(event);
      expect(start).toHaveBeenCalledTimes(allowed ? 1 : 0);
      if (allowed) {
        event.dx = 100;
        sourceView.onDragMove(event);
        expect(source._syncParent).toBeFalsy();
        sourceView.onDragEnd(event);
      } else {
        expect(stage.isDraggingBlock()).toBe(false);
        expect(source._syncParent).toBe(target);
      }
    } finally {
      event.setData({}, client.getBaseConn());
      start.mockRestore();
    }
  });

  it.each(['client', 'server'] as const)('checks the sync parent before resizing with %s policy', async (mode) => {
    Root.instance.queryProperty('PolicyUI.other.@b-xyw', true).setValue('add');
    const policy: EditPolicy = {allowPaths: ['PolicyUI.other.**'], readonlyPaths: ['**']};
    const [server, base] = makeLocalConnection(Root.instance, true, mode === 'server' ? policy : undefined);
    let client: ClientConn = mode === 'client' ? base.withPolicy(policy) : base;
    let stage: BlockStage;
    const [replacePolicy] = loadPolicyTemplate(
      client,
      (next) => {
        client = next;
      },
      () => (
        <EditPolicyProvider conn={client}>
          <BlockStage
            ref={(value) => {
              stage = value;
            }}
            conn={client}
            basePath="PolicyUI"
          />
        </EditPolicyProvider>
      ),
      'editor'
    );
    await shouldHappen(() => stage?.getBlock('PolicyUI.other')?._syncParent?.path === 'PolicyUI.add');
    const child = stage.getBlock('PolicyUI.other');
    const view = [...child._renderers][0] as BlockView;
    const event = new DragState(null, {dragType: 'left'} as any, true);
    const start = vi.spyOn(event, 'startDrag').mockImplementation(() => {});
    try {
      view.startDragW(event);
      expect(start).not.toHaveBeenCalled();
      (mode === 'client' ? replacePolicy : server.setEditPolicy.bind(server))({});
      await shouldHappen(() => view.context.canWriteField('PolicyUI.add.@b-xyw'));
      view.startDragW(event);
      expect(start).toHaveBeenCalledOnce();
      event.dx = 100;
      view.onDragWMove(event);
      view.onDragWEnd(event);
      await shouldHappen(() => (Root.instance.queryValue('PolicyUI.add.@b-xyw') as number[])?.[2] === 300);
      expect(child.w).toBe(300);
      expect(Root.instance.queryValue('PolicyUI.other.@b-xyw')).toBe('add');
    } finally {
      start.mockRestore();
    }
  });

  it.each(['client', 'server'] as const)('updates binding drops and existing slots from %s policy', async (mode) => {
    const policy: EditPolicy = {
      allowProps: [],
      denyProps: ['0'],
      allowBinding: ['0'],
    };
    const [server, base] = makeLocalConnection(Root.instance, true, mode === 'server' ? policy : undefined);
    let client: ClientConn = mode === 'client' ? base.withPolicy(policy) : base;
    let stage: BlockStage;
    const [replacePolicy, div] = loadPolicyTemplate(
      client,
      (next) => {
        client = next;
      },
      () => (
        <EditPolicyProvider conn={client}>
          <BlockStage
            ref={(value) => {
              stage = value;
            }}
            conn={client}
            basePath="PolicyUI"
          />
        </EditPolicyProvider>
      ),
      'editor'
    );
    const setPolicy = mode === 'client' ? replacePolicy : server.setEditPolicy.bind(server);
    await shouldHappen(() => stage?.getBlock('PolicyUI.add')?.fieldItems.get('1')?._renderers.size);
    const block = div.querySelector('.ticl-stage-scroll .ticl-block');
    const rows = block.querySelectorAll('.ticl-field');
    const slot = (index: number) => rows[index].querySelector('.ticl-slot');
    await shouldHappen(() => slot(0) && !slot(1));
    const renderer = (name: string) =>
      [...stage.getBlock('PolicyUI.add').fieldItems.get(name)._renderers][0] as FieldView;
    const event = new DragState(null, {dragType: 'left'} as any, true);
    event.setData({fields: ['PolicyUI.other.0']}, client.getBaseConn());
    let bind = vi.spyOn(client, 'setBinding');
    try {
      renderer('1').onDragOver(event);
      expect(event.rejected).toBe(true);
      expect(bind).not.toHaveBeenCalled();
      renderer('0').onDragOver(event);
      expect(event.rejected).toBe(false);
      renderer('0').onDrop(event);
      expect(bind).toHaveBeenCalledWith('PolicyUI.add.0', 'PolicyUI.other.0', true);
      await shouldHappen(() => Root.instance.queryProperty('PolicyUI.add.0')._bindingPath);

      setPolicy({allowBinding: ['1']});
      await shouldHappen(() => slot(0) && slot(1));
      expect(Root.instance.queryProperty('PolicyUI.add.0')._bindingPath).toBeTruthy();
      bind.mockRestore();
      bind = vi.spyOn(client, 'setBinding');
      renderer('0').onDragOver(event);
      expect(event.rejected).toBe(true);
      expect(bind).not.toHaveBeenCalled();
      setPolicy({allowBinding: []});
      await shouldHappen(() => slot(0) && !slot(1));
      Root.instance.queryProperty('PolicyUI.add.0').setBinding(null);
      await shouldHappen(() => !slot(0) && !slot(1));
      setPolicy({allowBinding: ['?']});
      await shouldHappen(() => slot(0) && slot(1));
      renderer('0').onDragOver(event);
      expect(event.rejected).toBe(false);
      setPolicy(undefined);
      await shouldHappen(() => slot(0) && slot(1));
    } finally {
      event.setData({}, client.getBaseConn());
      bind.mockRestore();
    }
  });

  for (const policy of [undefined, {allowProps: [], allowBinding: ['0', '1']}] as (EditPolicy | undefined)[]) {
    it(`updates outbound markers without reloading ${policy ? 'with' : 'without'} policy`, async () => {
      Root.instance.queryProperty('PolicyUI.other.@b-p', true).setValue(['0', '1']);
      Root.instance.queryProperty('PolicyUI.other.@b-xyw', true).setValue([420, 100, 200]);
      // An internal inputs listener must not hide a later, user-created binding.
      const inputs = (Root.instance.queryValue('PolicyUI') as Block).createBlock('#inputs');
      inputs.getProperty('0')._listenRaw(Root.instance.queryProperty('PolicyUI.add.0'));
      const [, base] = makeLocalConnection(Root.instance);
      let client: ClientConn = base.withPolicy(policy);
      let stage: BlockStage;
      const [replacePolicy, div] = loadPolicyTemplate(
        client,
        (next) => {
          client = next;
        },
        () => (
          <EditPolicyProvider conn={client}>
            <BlockStage
              ref={(value) => {
                stage = value;
              }}
              conn={client}
              basePath="PolicyUI"
            />
          </EditPolicyProvider>
        ),
        'editor'
      );
      await shouldHappen(() => stage?.getBlock('PolicyUI.other')?.fieldItems.get('1')?._renderers.size);
      const sourceRows = div.querySelector('.ticl-stage-scroll .ticl-block').querySelectorAll('.ticl-field');
      const outbound = (index: number) => sourceRows[index].querySelector('.ticl-outbound');
      const target = stage.getBlock('PolicyUI.other').fieldItems.get('0');
      const renderer = [...target._renderers][0] as FieldView;
      const event = new DragState(null, {dragType: 'left'} as any, true);
      try {
        await shouldHappen(() => stage.getBlock('PolicyUI.add').fieldItems.get('0').cache.hasListener === false);
        expect(outbound(0)).toBeNull();
        for (const source of ['0', '1', '0']) {
          event.setData({fields: [`PolicyUI.add.${source}`]}, client.getBaseConn());
          renderer.onDragOver(event);
          expect(event.rejected).toBe(false);
          renderer.onDrop(event);
          await shouldHappen(() => target._bindingTargetPath === `PolicyUI.add.${source}`);
          expect(target.inWire.source.path).toBe(`PolicyUI.add.${source}`);
          await shouldHappen(() => outbound(Number(source)) && !outbound(1 - Number(source)));
        }
        replacePolicy({allowBinding: []});
        await shouldHappen(() => outbound(0));
        Root.instance.queryProperty('PolicyUI.other.0').setBinding(undefined);
        await shouldHappen(() => !outbound(0) && !outbound(1));
        await shouldHappen(() => !target.inWire && !target.cache.bindingPath);
      } finally {
        event.setData({}, client.getBaseConn());
      }
    });
  }

  it('only includes permitted reorder operations when starting a drag', async () => {
    const [, base] = makeLocalConnection(Root.instance);
    let client: ClientConn = base.withPolicy({allowCmds: ['moveCustomProp']});
    let editor: PropertyEditor;
    const [replacePolicy] = loadPolicyTemplate(
      client,
      (next) => {
        client = next;
      },
      () => (
        <EditPolicyProvider conn={client}>
          <PropertyEditor
            ref={(value) => {
              editor = value;
            }}
            conn={client}
            paths={['PolicyUI.add']}
            name="a0"
            baseName="a"
            group="items"
            isCustom
            funcDesc={blankFuncDesc}
            propDesc={{name: 'a', type: 'number'}}
            reorder={CustomGroupPropertyReorder}
          />
        </EditPolicyProvider>
      ),
      'editor'
    );
    await shouldHappen(() => editor?.loaders.size);
    const event = new DragState(null, {dragType: 'right'} as any, true);
    const start = vi.spyOn(event, 'startDrag').mockImplementation(() => {});
    try {
      event.setData({}, client.getBaseConn());
      editor.onDragStart(event);
      expect(start).toHaveBeenCalledOnce();
      expect(DragState.getData('moveCustomField', client.getBaseConn())).toBe('a');
      expect(DragState.getData('moveGroupIndex', client.getBaseConn())).toBeUndefined();
      expect(CustomGroupPropertyReorder.onDragOver({...editor.props, name: 'a1'}, event)).toBeNull();
      const target = {...editor.props, name: 'b0', baseName: 'b'};
      expect(CustomGroupPropertyReorder.onDragOver(target, event)).toBe('tico-fas-exchange-alt');
      const move = vi.spyOn(client, 'moveCustomProp').mockReturnValue('');
      CustomGroupPropertyReorder.onDragDrop(target, event);
      expect(move).toHaveBeenCalledWith('PolicyUI.add', 'a', 'b', 'items');
      move.mockRestore();

      replacePolicy({allowCmds: ['moveGroupProp']});
      event.setData({}, client.getBaseConn());
      start.mockClear();
      editor.onDragStart(event);
      expect(start).toHaveBeenCalledOnce();
      expect(DragState.getData('moveCustomField', client.getBaseConn())).toBeUndefined();
      expect(DragState.getData('moveGroupIndex', client.getBaseConn())).toBe(0);
      expect(CustomGroupPropertyReorder.onDragOver({...editor.props, name: 'b0', baseName: 'b'}, event)).toBeNull();
      const grouped = {...editor.props, name: 'b1', baseName: 'b'};
      expect(CustomGroupPropertyReorder.onDragOver(grouped, event)).toBe('tico-fas-random');
      const reorderGroup = vi.spyOn(client, 'moveGroupProp').mockReturnValue('');
      CustomGroupPropertyReorder.onDragDrop(grouped, event);
      expect(reorderGroup).toHaveBeenCalledWith('PolicyUI.add', 'items', 0, 1);
      reorderGroup.mockRestore();

      replacePolicy({allowCmds: []});
      event.setData({}, client.getBaseConn());
      start.mockClear();
      editor.onDragStart(event);
      expect(start).not.toHaveBeenCalled();
    } finally {
      start.mockRestore();
      event.setData({}, client.getBaseConn());
    }
  });

  it('updates worker edit permissions even when the value remains editable', async () => {
    const [, base] = makeLocalConnection(Root.instance);
    let client: ClientConn = base.withPolicy({});
    const [replacePolicy, div] = loadPolicyTemplate(
      client,
      (next) => {
        client = next;
      },
      () => (
        <EditPolicyProvider conn={client}>
          <WorkerEditor
            conn={client}
            keys={['PolicyUI.add']}
            value="worker"
            onChange={() => {}}
            funcDesc={blankFuncDesc}
            desc={{name: 'worker', type: 'worker'}}
          />
        </EditPolicyProvider>
      ),
      'editor'
    );
    const edit = () => div.querySelector('.anticon-edit')?.closest('button');
    await shouldHappen(() => edit() && !edit().disabled);
    replacePolicy({denyCmds: ['editWorker']});
    await shouldHappen(() => edit().disabled);
    expect(div.querySelector('.anticon-down').closest('button').disabled).toBe(false);
    replacePolicy({});
    await shouldHappen(() => !edit().disabled);
  });

  it('disables service creation when binding or block creation is forbidden', async () => {
    const [, base] = makeLocalConnection(Root.instance);
    let client: ClientConn = base.withPolicy({});
    const [desc] = globalFunctions.getDescToSend('add');
    const [replacePolicy, div] = loadPolicyTemplate(
      client,
      (next) => {
        client = next;
      },
      () => (
        <EditPolicyProvider conn={client}>
          <PropertyEditor
            conn={client}
            paths={['PolicyUI.add']}
            name="service"
            funcDesc={desc}
            propDesc={{name: 'service', type: 'service', create: 'add', options: []}}
          />
        </EditPolicyProvider>
      ),
      'editor'
    );
    const create = () => div.querySelector('.ticl-service-editor .anticon-plus')?.closest('button');
    await shouldHappen(() => create() && !create().disabled);
    replacePolicy({allowBinding: []});
    await shouldHappen(() => create().disabled);
    replacePolicy({allowCreateBlock: false});
    await shouldHappen(() => create().disabled);
    replacePolicy({});
    await shouldHappen(() => !create().disabled);
  });
});
