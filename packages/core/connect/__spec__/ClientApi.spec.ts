import {expect} from 'vitest';
import {Block} from '../../block/Block.ts';
import {Flow, Root} from '../../block/Flow.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import '../../functions/math/Arithmetic.ts';
import '../../functions/Categories.ts';
import {AsyncClientPromise} from './AsyncClientPromise.ts';
import {VoidListeners, TestFunctionRunner} from '../../block/__spec__/TestFunction.ts';
import {FunctionDesc} from '../../block/Descriptor.ts';
import {shouldHappen, shouldReject} from '../../util/test-util.ts';
import {JsFunction} from '../../functions/script/Js.ts';
import {globalFunctions} from '../../block/FunctionLib.ts';
import {DataMap, isDataTruncated} from '../../util/DataTypes.ts';
import {WorkerFunctionGen} from '../../worker/WorkerFunctionGen.ts';
import {FlowEditor} from '../../worker/FlowEditor.ts';
import {WorkerFlow} from '../../worker/WorkerFlow.ts';

// @ts-ignore
const beforeAll = globalThis.beforeAll ?? globalThis.before;
// @ts-ignore
const afterAll = globalThis.afterAll ?? globalThis.after;

describe('Connection Client API', function () {
  beforeAll(function () {
    globalFunctions.addFactory(
      null,
      {
        name: 'func1',
        properties: [],
        optional: {p1: {name: 'p1', type: 'string'}},
      },
      'ClientConnection'
    );
    globalFunctions.addFactory(
      null,
      {
        base: 'ClientConnection:func1',
        name: 'func2',
        properties: [],
        optional: {p2: {name: 'p2', type: 'string'}},
      },
      'ClientConnection'
    );
    globalFunctions.addFactory(
      null,
      {
        base: 'ClientConnection:func2',
        name: 'func3',
        properties: [],
        optional: {p3: {name: 'p3', type: 'string'}},
      },
      'ClientConnection'
    );
    globalFunctions.addFactory(
      null,
      {
        base: 'ClientConnection:func1',
        name: 'func4',
        properties: [],
        optional: {p4: {name: 'p4', type: 'string'}},
      },
      'ClientConnection'
    );
    globalFunctions.addFactory(
      null,
      {
        base: 'ClientConnection:func2',
        name: 'func5',
        properties: [],
        optional: {p5: {name: 'p5', type: 'string'}},
      },
      'ClientConnection'
    );
  });

  afterAll(function () {
    globalFunctions.delete('ClientConnection:func1');
    globalFunctions.delete('ClientConnection:func2');
    globalFunctions.delete('ClientConnection:func3');
    globalFunctions.delete('ClientConnection:func4');
    globalFunctions.delete('ClientConnection:func5');
  });

  it('getCommonfuncFunc', async function () {
    const [server, client] = makeLocalConnection(Root.instance, true);
    await client.getValue('doesnt_matter__just_wait_for_init');

    const func1 = client.watchDesc('ClientConnection:func1');
    const func2 = client.watchDesc('ClientConnection:func2');
    const func3 = client.watchDesc('ClientConnection:func3');
    const func4 = client.watchDesc('ClientConnection:func4');
    const func5 = client.watchDesc('ClientConnection:func5');

    expect(client.getCommonBaseFunc(new Set([func5]))).toBe(func5);
    expect(client.getCommonBaseFunc(new Set([func3, func5]))).toBe(func2);
    expect(client.getCommonBaseFunc(new Set([func2, func3, func5]))).toBe(func2);
    expect(client.getCommonBaseFunc(new Set([func2, func4]))).toBe(func1);
    expect(client.getCommonBaseFunc(new Set([func3, func5, func4]))).toBe(func1);
    client.destroy();
  });

  it('getOptionalProps', async function () {
    const [server, client] = makeLocalConnection(Root.instance, true);
    await client.getValue('doesnt_matter__just_wait_for_init');

    const func1 = client.watchDesc('ClientConnection:func1');
    const func5 = client.watchDesc('ClientConnection:func5');

    expect(Object.keys(client.getOptionalProps(func1))).toEqual(['p1']);
    expect(Object.keys(client.getOptionalProps(func5))).toEqual(['p1', 'p2', 'p5']);

    client.destroy();
  });
});
