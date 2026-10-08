import {expect} from 'vitest';
import React, {StrictMode} from 'react';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {Root} from '@ticlo/core';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.ts';
import {DescRequest} from '@ticlo/core/connect/ClientRequests.ts';
import {FunctionTreeRoot} from '../FunctionTreeItem.ts';
import {FunctionTreeRenderer} from '../FunctionTreeRenderer.tsx';
import {FunctionSelect} from '../FunctionSelect.tsx';
import {FunctionTree} from '../FunctionTree.tsx';
import {FunctionView} from '../FunctionView.tsx';
import {loadTemplate, querySingle, removeLastTemplate} from '../../util/test-util.ts';

describe('FunctionTree', function () {
  it('restores descriptor listeners after StrictMode remounts', async () => {
    const root = new Root();
    const [, conn] = makeLocalConnection(root);
    let tree: FunctionTree;
    try {
      loadTemplate(
        <StrictMode>
          <FunctionTree
            conn={conn}
            ref={(value) => {
              tree = value;
            }}
          />
        </StrictMode>,
        'editor'
      );
      await shouldHappen(() => tree?.rootNode?.children?.length > 0);
      tree.forceUpdate();
      await shouldHappen(() => tree.list.length > 0);
      expect(conn.descListenerPaths.has(tree.rootNode.onDesc)).toBe(true);
      const listener = tree.rootNode.onDesc;
      removeLastTemplate();
      expect(conn.descListenerPaths.has(listener)).toBe(false);
    } finally {
      removeLastTemplate();
      conn.destroy();
      root.destroy();
    }
  });

  const scopeSuffixes = ['', '.#lib', '.child.#lib', '.child.nested.#lib'];

  function findElements(node: any, predicate: (element: any) => boolean): any[] {
    if (Array.isArray(node)) {
      return node.flatMap((child) => findElements(child, predicate));
    }
    if (!React.isValidElement(node)) {
      return [];
    }
    const matches = predicate(node) ? [node] : [];
    return matches.concat(findElements((node.props as any).children, predicate));
  }

  it('passes funcLib when editing an in-flow function', function () {
    let editRequest: any;
    const view = new FunctionView({
      conn: {
        editWorker: (...args: any[]) => {
          editRequest = args;
        },
        applyFlowChange: () => {},
      },
      desc: {id: ':a', name: 'a', src: 'worker'},
      funcLib: 'FunctionTreeScope',
    } as any);
    view.context = {
      onFlowFocus: () => {},
      onFlowClosed: () => {},
      editFlow: () => {},
    };

    view.onEditClicked();

    expect(editRequest).toEqual(['#temp.#edit-%3aa', null, ':a', undefined, 'FunctionTreeScope']);
  });

  it('passes funcLib when deleting an in-flow function', function () {
    let deleteRequest: any;
    const view = new FunctionView({
      conn: {
        deleteFunction: (...args: any[]) => {
          deleteRequest = args;
        },
      },
      desc: {id: ':a', name: 'a', src: 'worker'},
      funcLib: 'FunctionTreeScope',
    } as any);

    view.onDeleteClicked();

    expect(deleteRequest).toEqual([':a', 'FunctionTreeScope', {onError: expect.any(Function)}]);
  });

  it('does not pass funcLib when editing a global function', function () {
    let editRequest: any;
    const view = new FunctionView({
      conn: {
        editWorker: (...args: any[]) => {
          editRequest = args;
        },
        applyFlowChange: () => {},
      },
      desc: {id: '+demo:test', name: 'test', src: 'worker'},
      funcLib: 'FunctionTreeScope',
    } as any);
    view.context = {
      onFlowFocus: () => {},
      onFlowClosed: () => {},
      editFlow: () => {},
    };

    view.onEditClicked();

    expect(editRequest).toEqual(['#temp.#edit-+demo%3atest', null, '+demo:test', undefined, undefined]);
  });

  it('shows the context menu for an in-flow function', function () {
    const view = new FunctionView({
      conn: {
        getCategory: (): undefined => undefined,
      },
      desc: {id: ':a', name: 'a', src: 'worker'},
      funcLib: 'FunctionTreeScope',
    } as any);
    view.context = {
      onFlowFocus: () => {},
      onFlowClosed: () => {},
      editFlow: () => {},
    };

    const rendered = view.render();

    expect((rendered as any).props.trigger).toEqual(['contextMenu']);
  });

  it('shows add function only on the selected in-flow tree', function () {
    const select = new FunctionSelect({conn: {}} as any);
    select.context = {
      onFlowFocus: () => {},
      onFlowClosed: () => {},
      editFlow: () => {},
    };

    let rendered = select.render();
    expect(findElements(rendered, (element) => element.props.className === 'ticl-e-func-tree-add-btn')).toHaveLength(0);

    select.state = {...select.state, tab: 'inFlow'};
    rendered = select.render();

    const addButtons = findElements(rendered, (element) => element.props.className === 'ticl-e-func-tree-add-btn');
    const treeWrappers = findElements(rendered, (element) => element.props.className === 'ticl-e-func-tree-wrap');
    expect(addButtons).toHaveLength(1);
    expect(
      findElements(treeWrappers[0], (element) => element.props.className === 'ticl-e-func-tree-add-btn')
    ).toHaveLength(1);
  });

  it.each(scopeSuffixes)('shows inflow functions as flat items (%s)', async function (scopeSuffix) {
    const flowPath = `FunctionTreeInflow${Math.random().toString(36).slice(2)}`;
    const flow = Root.instance.addFlow(flowPath);
    flow.createBlock('child').createBlock('nested');
    const scopePath = `${flowPath}${scopeSuffix}`;
    const [server, client] = makeLocalConnection(Root.instance, true);
    DescRequest.editorCache.clear();

    WorkerFunctionGen.registerType({'#is': ''}, {id: ':a', name: 'a'}, undefined, flow.getFuncLib());

    let selected: string;
    const root = new FunctionTreeRoot(
      client,
      () => {},
      (name, desc) => {
        selected = desc.id;
      },
      false,
      undefined,
      scopePath
    );

    await shouldHappen(() => client.watchDesc(':a', scopePath));

    expect(root.children.length).toBe(1);
    expect(root.children[0].key).toBe(':a');
    expect(root.children[0].name).toBe('a');
    expect(root.children[0].desc.id).toBe(':a');
    expect(root.children[0].desc.properties).toEqual([]);

    loadTemplate(<FunctionTreeRenderer item={root.children[0]} />, 'editor');
    expect(querySingle("//div.ticl-e-func-view/span[text()='a']", document.body)).toBeDefined();
    expect(querySingle("//div.ticl-e-tree-type/span[text()='a']", document.body)).toBeNull();

    root.onFunctionClick(root.children[0].name, root.children[0].desc, root.children[0].data);
    expect(selected).toBe(':a');

    removeLastTemplate();
    root.destroy();
    client.destroy();
    Root.instance.deleteValue(flowPath);
  });

  it.each(scopeSuffixes)('updates inflow tree after saving and deleting (%s)', async function (scopeSuffix) {
    const flowPath = `FunctionTreeSave${Math.random().toString(36).slice(2)}`;
    const flow = Root.instance.addFlow(flowPath, {});
    flow.createBlock('child').createBlock('nested');
    const scopePath = `${flowPath}${scopeSuffix}`;
    const [server, client] = makeLocalConnection(Root.instance, true);
    const root = new FunctionTreeRoot(client, () => {}, undefined, false, undefined, scopePath);
    const editPath = '#temp.#edit-%3aa';

    await client.editWorker(editPath, undefined, ':a', {'#inputs': {'#is': ''}, '#outputs': {'#is': ''}}, scopePath);
    await client.setValue(`${editPath}.#desc`, {icon: 'fas:plus'}, true);
    await client.applyFlowChange(editPath);

    await shouldHappen(() => client.watchDesc(':a', scopePath));
    expect(root.children.map((child) => [child.key, child.name])).toEqual([[':a', 'a']]);
    expect(flow.getFuncLib().getAllFunctionIds()).toContain(':a');

    await client.deleteFunction(':a', scopePath);
    await shouldHappen(() => root.children.length === 0);
    expect(flow.getFuncLib().getAllFunctionIds()).not.toContain(':a');

    root.destroy();
    client.destroy();
    Root.instance.deleteValue(flowPath);
  });

  it('updates global tree after saving a new namespace worker function', async function () {
    const runtime = new Root();
    await runtime.start({demo: {}});
    const [server, client] = makeLocalConnection(runtime, true);
    const root = new FunctionTreeRoot(client, () => {}, undefined, false, undefined, undefined);
    const editPath = '#temp.#edit-%2Bdemo%3Ag%3Atest';

    try {
      await client.editWorker(editPath, undefined, '+demo:g:test', {'#inputs': {'#is': ''}, '#outputs': {'#is': ''}});
      await client.setValue(`${editPath}.#desc`, {icon: 'fas:plus'}, true);
      await client.applyFlowChange(editPath);

      await shouldHappen(() => client.watchDesc('+demo:g:test'));
      const demo = root.typeMap.get('+demo:');
      const group = root.typeMap.get('+demo:g:');
      const test = root.typeMap.get('+demo:g:test');
      expect(demo?.name).toBe('+demo');
      expect(group?.name).toBe('g');
      expect(test?.name).toBe('test');
      expect(test?.desc.id).toBe('+demo:g:test');
    } finally {
      root.destroy();
      client.destroy();
      await runtime.stop({discardChanges: true});
      runtime.destroy();
    }
  });
});
