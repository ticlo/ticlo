import {expect, vi} from 'vitest';
import React, {StrictMode} from 'react';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {Root, type FunctionDesc} from '@ticlo/core';
import type {ClientConn} from '@ticlo/core/connect/ClientConn.ts';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.ts';
import {DescRequest} from '@ticlo/core/connect/ClientRequests.ts';
import {FunctionTreeRoot} from '../FunctionTreeItem.ts';
import {FunctionTreeRenderer} from '../FunctionTreeRenderer.tsx';
import {FunctionTree} from '../FunctionTree.tsx';
import {FunctionView} from '../FunctionView.tsx';
import {initEditor} from '../../index.ts';
import {loadTemplate, querySingle, removeLastTemplate} from '../../util/test-util.ts';

describe('FunctionTree', function () {
  it('groups SVG functions without removing the category when the svg function updates', () => {
    const conn = {watchDesc() {}, unwatchDesc() {}} as unknown as ClientConn;
    const root = new FunctionTreeRoot(conn, () => {});
    const category = {id: 'react:svg:', name: 'SVG'} as FunctionDesc;
    const shape = {id: 'react:rect', name: 'rect', category: 'react:svg', properties: []} as FunctionDesc;
    const svg = {id: 'react:svg', name: 'svg', properties: []} as FunctionDesc;

    root.onDesc(category, category.id);
    root.onDesc(shape, shape.id);
    root.onDesc(svg, svg.id);
    expect(root.typeMap.get('react:svg:')?.children.map((item) => item.key)).toEqual(['react:rect']);
    expect(root.typeMap.get('react:')?.children.map((item) => item.key)).toContain('react:svg');

    root.onDesc({...svg}, svg.id);
    expect(root.typeMap.get('react:svg:')?.children.map((item) => item.key)).toEqual(['react:rect']);
    root.destroy();
  });

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

  const scopeSuffixes = ['', '.child.nested.#module'];

  it('passes funcModule when editing an in-flow function', function () {
    let editRequest: any;
    const view = new FunctionView({
      conn: {
        editWorker: (...args: any[]) => {
          editRequest = args;
        },
        applyFlowChange: () => {},
      },
      desc: {id: ':a', name: 'a', src: 'worker'},
      funcModule: 'FunctionTreeScope',
    } as any);
    view.context = {
      onFlowFocus: () => {},
      onFlowClosed: () => {},
      editFlow: () => {},
    };

    view.onEditClicked();

    expect(editRequest).toEqual(['#temp.#edit-%3aa', null, ':a', undefined, 'FunctionTreeScope']);
  });

  it('passes funcModule when deleting an in-flow function', function () {
    let deleteRequest: any;
    const view = new FunctionView({
      conn: {
        deleteFunction: (...args: any[]) => {
          deleteRequest = args;
        },
      },
      desc: {id: ':a', name: 'a', src: 'worker'},
      funcModule: 'FunctionTreeScope',
    } as any);

    view.onDeleteClicked();

    expect(deleteRequest).toEqual([':a', 'FunctionTreeScope', {onError: expect.any(Function)}]);
  });

  it('does not pass funcModule when editing a global function', function () {
    let editRequest: any;
    const view = new FunctionView({
      conn: {
        editWorker: (...args: any[]) => {
          editRequest = args;
        },
        applyFlowChange: () => {},
      },
      desc: {id: '+demo:test', name: 'test', src: 'worker'},
      funcModule: 'FunctionTreeScope',
    } as any);
    view.context = {
      onFlowFocus: () => {},
      onFlowClosed: () => {},
      editFlow: () => {},
    };

    view.onEditClicked();

    expect(editRequest).toEqual(['#temp.#edit-+demo%3atest', null, '+demo:test', undefined, undefined]);
  });

  it.each(scopeSuffixes)('shows inflow functions as flat items (%s)', async function (scopeSuffix) {
    const flowPath = `FunctionTreeInflow${Math.random().toString(36).slice(2)}`;
    const flow = Root.instance.addFlow(flowPath);
    flow.createBlock('child').createBlock('nested');
    const scopePath = `${flowPath}${scopeSuffix}`;
    const [server, client] = makeLocalConnection(Root.instance, true);
    DescRequest.editorCache.clear();

    WorkerFunctionGen.registerType({'#is': ''}, {id: ':a', name: 'a'}, undefined, flow.getFuncModule());

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
    await client.setValue(`${editPath}.#desc`, {icon: '23:🞥'}, true);
    await client.applyFlowChange(editPath);

    await shouldHappen(() => client.watchDesc(':a', scopePath));
    expect(root.children.map((child) => [child.key, child.name])).toEqual([[':a', 'a']]);
    expect(flow.getFuncModule().getAllFunctionIds()).toContain(':a');

    await client.deleteFunction(':a', scopePath);
    await shouldHappen(() => root.children.length === 0);
    expect(flow.getFuncModule().getAllFunctionIds()).not.toContain(':a');

    root.destroy();
    client.destroy();
    Root.instance.deleteValue(flowPath);
  });

  it('updates global tree after saving a new library worker function', async function () {
    const runtime = new Root();
    await runtime.start({demo: {}});
    const [server, client] = makeLocalConnection(runtime, true);
    const root = new FunctionTreeRoot(client, () => {}, undefined, false, undefined, undefined);
    const editPath = '#temp.#edit-%2Bdemo%3Ag%3Atest';

    try {
      await client.editWorker(editPath, undefined, '+demo:g:test', {'#inputs': {'#is': ''}, '#outputs': {'#is': ''}});
      await client.setValue(`${editPath}.#desc`, {icon: '23:🞥'}, true);
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

  it('groups cross-library useFullName functions under their category, hides library badge, and drags full name', async () => {
    await initEditor();
    const databaseCategory = {id: 'database:', name: 'database', color: '4af', icon: '13:DB'} as FunctionDesc;
    const conn = {
      watchDesc(): void {},
      unwatchDesc(): void {},
      lockImmediate(): void {},
      unlockImmediate(): void {},
      getCategory: (cat: string): FunctionDesc => (cat === 'database' ? databaseCategory : null),
      getBaseConn: (): ClientConn => null,
    } as unknown as ClientConn;
    const root = new FunctionTreeRoot(conn, () => {});
    const sqliteDesc: FunctionDesc = {
      id: 'sqlite:client',
      name: 'client',
      libraryId: 'sqlite',
      category: 'database',
      useFullName: true,
      properties: [],
    };
    const postgresDesc: FunctionDesc = {
      id: 'postgres:client',
      name: 'client',
      libraryId: 'postgres',
      category: 'database',
      useFullName: true,
      properties: [],
    };

    try {
      root.onDesc(databaseCategory, databaseCategory.id);
      root.onDesc(sqliteDesc, sqliteDesc.id);
      root.onDesc(postgresDesc, postgresDesc.id);

      expect(root.typeMap.has('sqlite:')).toBe(false);
      expect(root.typeMap.has('postgres:')).toBe(false);
      const dbItems = root.typeMap.get('database:')?.children;
      expect(dbItems?.map((item) => [item.key, item.name])).toEqual([
        ['postgres:client', 'postgres-client'],
        ['sqlite:client', 'sqlite-client'],
      ]);

      const sqliteItem = root.typeMap.get('sqlite:client');
      expect(sqliteItem.matchSearch('sqlite-client')).toBe(true);
      expect(sqliteItem.matchSearch('sqlite')).toBe(true);

      const [, div] = loadTemplate(<FunctionTreeRenderer item={sqliteItem} />, 'editor');
      const funcViewEl = await shouldHappen(() => div.querySelector<HTMLElement>('.ticl-e-func-view'));
      expect(funcViewEl.style.getPropertyValue('--ticl-block-color')).toBe('#4af');
      expect(div.querySelector('.ticl-e-func-library')).toBeNull();
      expect(div.querySelector('.ticl-e-func-name')?.textContent).toBe('sqlite-client');

      const setData = vi.fn();
      const view = new FunctionView({conn, desc: sqliteDesc});
      view.onDrag({event: {}, setData, startDrag: vi.fn()} as any);
      expect(setData).toHaveBeenCalledWith(expect.objectContaining({blockName: 'sqlite-client'}), null);
    } finally {
      removeLastTemplate();
      root.destroy();
    }
  });
});
