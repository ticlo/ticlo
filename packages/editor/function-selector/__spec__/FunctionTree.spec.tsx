import {expect} from 'vitest';
import React from 'react';
import {shouldHappen} from '@ticlo/core/util/test-util.js';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.js';
import {Root} from '@ticlo/core';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.js';
import {DescRequest} from '@ticlo/core/connect/ClientRequests.js';
import {FunctionTreeRoot} from '../FunctionTreeItem.js';
import {FunctionTreeRenderer} from '../FunctionTreeRenderer.js';
import {loadTemplate, querySingle, removeLastTemplate} from '../../util/test-util.js';
import {Namespace} from '@ticlo/core/block/Namespace.js';

describe('FunctionTree', function () {
  it('shows inflow functions as flat function items', async function () {
    const flowPath = `FunctionTreeInflow${Math.random().toString(36).slice(2)}`;
    const flow = Root.instance.addFlow(flowPath);
    const [server, client] = makeLocalConnection(Root.instance, true);
    DescRequest.editorCache.clear();

    WorkerFunctionGen.registerType({'#is': ''}, {id: ':a', name: 'a'}, undefined, flow.getFuncGroup());

    let selected: string;
    const root = new FunctionTreeRoot(
      client,
      () => {},
      (name, desc) => {
        selected = desc.id;
      },
      false,
      undefined,
      flowPath
    );

    await shouldHappen(() => client.watchDesc(':a', flowPath));

    expect(root.children.length).toBe(1);
    expect(root.children[0].key).toBe(':a');
    expect(root.children[0].name).toBe('a');
    expect(root.children[0].desc.id).toBe(':a');
    expect(root.children[0].desc.properties).toEqual([]);

    loadTemplate(<FunctionTreeRenderer item={root.children[0]} />, 'editor');
    expect(querySingle("//div.ticl-func-view/span[text()='a']", document.body)).toBeDefined();
    expect(querySingle("//div.ticl-tree-type/span[text()='a']", document.body)).toBeNull();

    root.onFunctionClick(root.children[0].name, root.children[0].desc, root.children[0].data);
    expect(selected).toBe(':a');

    removeLastTemplate();
    root.destroy();
    client.destroy();
    Root.instance.deleteValue(flowPath);
  });

  it('updates inflow tree after saving a new local worker function', async function () {
    const flowPath = `FunctionTreeSave${Math.random().toString(36).slice(2)}`;
    const flow = Root.instance.addFlow(flowPath, {});
    const [server, client] = makeLocalConnection(Root.instance, true);
    const root = new FunctionTreeRoot(client, () => {}, undefined, false, undefined, flowPath);
    const editPath = '#temp.#edit-%3aa';

    await client.editWorker(editPath, undefined, ':a', {'#inputs': {'#is': ''}, '#outputs': {'#is': ''}}, flowPath);
    await client.setValue(`${editPath}.#desc`, {icon: 'fas:plus'}, true);
    await client.applyFlowChange(editPath);

    await shouldHappen(() => client.watchDesc(':a', flowPath));
    expect(root.children.map((child) => [child.key, child.name])).toEqual([[':a', 'a']]);

    root.destroy();
    client.destroy();
    Root.instance.deleteValue(flowPath);
  });

  it('updates global tree after saving a new namespace worker function', async function () {
    const [server, client] = makeLocalConnection(Root.instance, true);
    const root = new FunctionTreeRoot(client, () => {}, undefined, false, undefined, undefined);
    const editPath = '#temp.#edit-%2Bdemo%3Ag%3Atest';

    Namespace.loadNameSpaces(['+demo']);
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

    root.destroy();
    client.destroy();
    Namespace.delete('+demo:g:test');
  });
});
