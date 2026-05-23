import {expect} from 'vitest';
import {Flow, Root} from '../../block/Flow.js';
import {makeLocalConnection} from '../LocalConnection.js';
import '../../functions/math/Arithmetic.js';
import '../../functions/Categories.js';
import {shouldHappen} from '../../util/test-util.js';
import {Namespace} from '../../block/Namespace.js';
import {WorkerFunctionGen} from '../../worker/WorkerFunctionGen.js';

describe('InflowEditor Connection Workflow', function () {
  it('keeps folder and child-flow function groups stable and separate', async function () {
    const folderPath = 'InflowEditorFunctionLibFolder';
    const childPath = `${folderPath}.child`;

    Root.instance.addFlowFolder(folderPath);
    const folder = Root.instance.queryValue(folderPath) as Flow;
    const folderGroup = folder.getFuncLib();

    expect(folder.getFuncLib()).toBe(folderGroup);

    Root.instance.addFlow(childPath, {});
    const child = Root.instance.queryValue(childPath) as Flow;

    expect(child.getFuncLib()).not.toBe(folderGroup);
    expect(child.getFuncLib()).toBe(child.getFuncLib());

    Root.instance.deleteValue(folderPath);
  });

  it('creates an inflow function before opening its editor', async function () {
    const flowPath = 'InflowEditorWorkflowCreateFirst';
    const funcId = ':draftWorker';
    const editPath = `#temp.#edit-${encodeURIComponent(funcId)}`;

    const [server, client] = makeLocalConnection(Root.instance, true);

    await client.addFlow(flowPath, {});
    const flow = Root.instance.queryValue(flowPath) as Flow;
    let watchedDesc: any;
    const descListener = (desc: any, id: string) => {
      if (id === funcId) {
        watchedDesc = desc;
      }
    };
    client.watchDesc('*', flowPath, descListener);

    await client.editWorker(
      editPath,
      undefined,
      funcId,
      {'#is': '', '#inputs': {'#is': ''}, '#outputs': {'#is': ''}},
      flowPath
    );

    expect(flow.getFuncLib().getAllFunctionIds()).toContain(funcId);
    await shouldHappen(() => watchedDesc);

    client.unwatchDesc(descListener);
    client.destroy();
    Root.instance.deleteValue(flowPath);
  });

  it('creates a namespace function before opening its editor', async function () {
    const funcId = '+InflowEditorWorkflow:createFirst:draftWorker';
    const editPath = `#temp.#edit-${encodeURIComponent(funcId)}`;

    const [server, client] = makeLocalConnection(Root.instance, true);

    await client.editWorker(editPath, undefined, funcId, {'#is': '', '#inputs': {'#is': ''}, '#outputs': {'#is': ''}});

    await shouldHappen(() => client.watchDesc(funcId));
    const [desc] = Namespace.getDescToSend(funcId);
    expect(desc?.id).toBe(funcId);

    Namespace.delete(funcId);
    client.destroy();
  });

  it('scopes descriptor watches through #lib', async function () {
    const flowPath = 'InflowEditorDescriptorScope';
    const funcId = ':scopedDesc';
    const data = {
      '#is': '',
      '#inputs': {'#is': '', '#custom': [{name: 'value', type: 'number'}]},
      '#outputs': {'#is': ''},
    };

    Root.instance.addFlow(flowPath, {});
    const flow = Root.instance.queryValue(flowPath) as Flow;
    WorkerFunctionGen.registerType(data, {id: funcId, name: 'scopedDesc'}, undefined, flow.getFuncLib());

    const [server, client] = makeLocalConnection(Root.instance, true);

    let scopedDesc: any;
    client.watchDesc(funcId, flowPath, (desc) => {
      scopedDesc = desc;
    });

    await shouldHappen(() => scopedDesc?.id === funcId);
    expect(client.watchDesc(funcId)).toBeUndefined();
    expect(client.watchDesc(funcId, flowPath)?.properties.some((prop) => prop.name === 'value')).toBe(true);

    client.destroy();
    Root.instance.deleteValue(flowPath);
  });

  it('creates, edits, and runs an inflow function through the connection', async function () {
    const flowPath = 'InflowEditorWorkflow0';
    const funcId = ':plusOne';
    const editPath = `#temp.#edit-${encodeURIComponent(funcId)}`;

    const [server, client] = makeLocalConnection(Root.instance, true);

    await client.addFlow(flowPath, {});

    const flow = Root.instance.queryValue(flowPath) as Flow;
    expect(flow).toBeInstanceOf(Flow);

    await client.editWorker(
      editPath,
      undefined,
      funcId,
      {
        '#is': '',
        '#desc': {base: 'add'},
        '#inputs': {'#is': ''},
        '#outputs': {'#is': ''},
      },
      flowPath
    );

    await client.setValue(`${editPath}.#inputs.#custom`, [{name: 'n', type: 'number'}], true);
    await client.setValue(`${editPath}.#outputs.#custom`, [{name: 'result', type: 'number'}], true);
    await client.addBlock(`${editPath}.add`, {'#is': 'add'});
    await client.setBinding(`${editPath}.add.0`, '##.#inputs.n', false, true);
    await client.setValue(`${editPath}.add.1`, 1, true);
    await client.setBinding(`${editPath}.#outputs.result`, '##.add.#output', false, true);

    await client.applyFlowChange(editPath, funcId);

    await shouldHappen(() => flow.getFuncLib().getAllFunctionIds().includes(funcId));

    const [desc] = flow.getFuncLib().getDescToSend(funcId);
    expect(desc.base).toBe('add');
    expect(desc.properties).toEqual([
      {name: 'n', type: 'number'},
      {name: 'result', type: 'number', readonly: true},
    ]);

    await client.addBlock(`${flowPath}.calc`, {'#is': funcId});
    await client.setValue(`${flowPath}.calc.n`, 2, true);
    Root.runAll();

    expect(flow.queryValue('calc.result')).toBe(3);

    client.destroy();
    Root.instance.deleteValue(flowPath);
  });

  it('resolves an inflow function class on a flow folder', async function () {
    const flowPath = 'InflowEditorWorkflowFolder';
    const funcId = ':folderDouble';
    const editPath = `#temp.#edit-${encodeURIComponent(funcId)}`;

    const [server, client] = makeLocalConnection(Root.instance, true);

    await client.addFlowFolder(flowPath);
    const flow = Root.instance.queryValue(flowPath) as Flow;

    await client.editWorker(
      editPath,
      undefined,
      funcId,
      {'#is': '', '#inputs': {'#is': ''}, '#outputs': {'#is': ''}},
      flowPath
    );
    await client.applyFlowChange(editPath);

    await client.addBlock(`${flowPath}.calc`, {'#is': funcId});

    expect(flow.queryValue('calc.#')?.getFunctionClass()).toBeDefined();

    client.destroy();
    Root.instance.deleteValue(flowPath);
  });
});
