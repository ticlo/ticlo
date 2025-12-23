import {expect} from 'vitest';
import {Block} from '../../block/Block.js';
import {Flow, Root} from '../../block/Flow.js';
import {makeLocalConnection} from '../LocalConnection.js';
import '../../functions/math/Arithmetic.js';
import '../../functions/Categories.js';
import {AsyncClientPromise} from './AsyncClientPromise.js';
import {VoidListeners, TestFunctionRunner} from '../../block/__spec__/TestFunction.js';
import {FunctionDesc} from '../../block/Descriptor.js';
import {shouldHappen, shouldReject} from '../../util/test-util.js';
import {JsFunction} from '../../functions/script/Js.js';
import {Functions} from '../../block/Functions.js';
import {DataMap, isDataTruncated} from '../../util/DataTypes.js';
import {WorkerFunctionGen} from '../../worker/WorkerFunctionGen.js';
import {FlowEditor} from '../../worker/FlowEditor.js';
import {WorkerFlow} from '../../worker/WorkerFlow.js';

// @ts-ignore
const beforeAll = globalThis.beforeAll ?? globalThis.before;
// @ts-ignore
const afterAll = globalThis.afterAll ?? globalThis.after;

describe('Connection Client API', function () {
  beforeAll(function () {
    Functions.add(
      null,
      {
        name: 'func1',
        properties: [],
        optional: {p1: {name: 'p1', type: 'string'}},
      },
      'ClientConnection'
    );
    Functions.add(
      null,
      {
        base: 'ClientConnection:func1',
        name: 'func2',
        properties: [],
        optional: {p2: {name: 'p2', type: 'string'}},
      },
      'ClientConnection'
    );
    Functions.add(
      null,
      {
        base: 'ClientConnection:func2',
        name: 'func3',
        properties: [],
        optional: {p3: {name: 'p3', type: 'string'}},
      },
      'ClientConnection'
    );
    Functions.add(
      null,
      {
        base: 'ClientConnection:func1',
        name: 'func4',
        properties: [],
        optional: {p4: {name: 'p4', type: 'string'}},
      },
      'ClientConnection'
    );
    Functions.add(
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
    Functions.deleteFunction('ClientConnection:func1');
    Functions.deleteFunction('ClientConnection:func2');
    Functions.deleteFunction('ClientConnection:func3');
    Functions.deleteFunction('ClientConnection:func4');
    Functions.deleteFunction('ClientConnection:func5');
  });

  it('getCommonfuncFunc', async function () {
    let [server, client] = makeLocalConnection(Root.instance, true);
    await client.getValue('doesnt_matter__just_wait_for_init');

    let func1 = client.watchDesc('ClientConnection:func1');
    let func2 = client.watchDesc('ClientConnection:func2');
    let func3 = client.watchDesc('ClientConnection:func3');
    let func4 = client.watchDesc('ClientConnection:func4');
    let func5 = client.watchDesc('ClientConnection:func5');

    expect(client.getCommonBaseFunc(new Set([func5]))).toBe(func5);
    expect(client.getCommonBaseFunc(new Set([func3, func5]))).toBe(func2);
    expect(client.getCommonBaseFunc(new Set([func2, func3, func5]))).toBe(func2);
    expect(client.getCommonBaseFunc(new Set([func2, func4]))).toBe(func1);
    expect(client.getCommonBaseFunc(new Set([func3, func5, func4]))).toBe(func1);
    client.destroy();
  });

  it('getOptionalProps', async function () {
    let [server, client] = makeLocalConnection(Root.instance, true);
    await client.getValue('doesnt_matter__just_wait_for_init');

    let func1 = client.watchDesc('ClientConnection:func1');
    let func5 = client.watchDesc('ClientConnection:func5');

    expect(Object.keys(client.getOptionalProps(func1))).toEqual(['p1']);
    expect(Object.keys(client.getOptionalProps(func5))).toEqual(['p1', 'p2', 'p5']);

    client.destroy();
  });
});
