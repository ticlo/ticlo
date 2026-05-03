import {expect} from 'vitest';
import {Flow, Root} from '../../block/Flow.js';
import {makeLocalConnection} from '../LocalConnection.js';
import '../../functions/math/Arithmetic.js';
import '../../functions/Categories.js';
import {shouldHappen} from '../../util/test-util.js';

describe('InflowEditor Connection Workflow', function () {
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

    await shouldHappen(() => flow.getFuncGroup().getAllFunctionIds().includes(funcId));

    const [desc] = flow.getFuncGroup().getDescToSend(funcId);
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
});
