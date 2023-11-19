import expect from 'expect';
import {Block} from '../../block/Block';
import {Flow, Root} from '../../block/Flow';
import {makeLocalConnection} from '../LocalConnection';
import '../../functions/math/Arithmetic';
import '../../functions/Categories';
import {AsyncClientPromise} from './AsyncClientPromise';
import {VoidListeners, TestFunctionRunner} from '../../block/spec/TestFunction';
import {FunctionDesc} from '../../block/Descriptor';
import {shouldHappen, shouldReject} from '../../util/test-util';
import {JsFunction} from '../../functions/script/Js';
import {Functions} from '../../block/Functions';
import {DataMap, isDataTruncated} from '../../util/DataTypes';
import {WorkerFunction} from '../../worker/WorkerFunction';
import {FlowEditor} from '../../worker/FlowEditor';
import {WorkerFlow} from '../../worker/WorkerFlow';
import {Logger} from '../../util/Logger';

describe('Connection', function () {
  it('get', async function () {
    let flow = Root.instance.addFlow('Connection0');
    let data = {a: 0};
    flow.setValue('v', data);

    let [server, client] = makeLocalConnection(Root.instance, false);

    let callbacks = new AsyncClientPromise();
    client.getValue('Connection0.v', callbacks);
    let result = await callbacks.promise;
    expect(result.value).toEqual(data);

    // clean up
    callbacks.cancel();
    client.destroy();
    Root.instance.deleteValue('Connection0');
  });

  it('subscribe', async function () {
    let flow = Root.instance.addFlow('Connection1');
    let [server, client] = makeLocalConnection(Root.instance, false);

    await client.addBlock('Connection1.block1', {'#is': 'add'});
    expect(flow.queryValue('block1.#is')).toBe('add');

    let callbacks = new AsyncClientPromise();
    client.subscribe('Connection1.block1.#output', callbacks);
    let result = await callbacks.promise;
    expect(result.cache.value).toBeUndefined();

    client.setValue('Connection1.block1.0', 2);
    client.updateValue('Connection1.block1.1', 3);
    result = await callbacks.promise;
    expect(result.change.value).toBe(5);

    // clean up
    callbacks.cancel();
    client.destroy();
    Root.instance.deleteValue('Connection1');
  });

  it('bind', async function () {
    let flow = Root.instance.addFlow('Connection1-2');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let callbacks = new AsyncClientPromise();
    client.subscribe('Connection1-2.v', callbacks);

    flow.setValue('a', 3);
    flow.setValue('b', 'b');
    flow.setValue('o', [{p: 'p'}]);
    await client.setBinding('Connection1-2.v', 'a', false, true);
    expect(flow.getValue('v')).toBe(3);
    expect((await callbacks.firstPromise).cache.bindingPath).toBe('a');

    await client.setBinding('Connection1-2.v', 'Connection1-2.b', true, true);
    expect(flow.getValue('v')).toBe('b');
    await client.setBinding('Connection1-2.v', 'Connection1-2.o..0.p', true, true);
    expect(flow.getValue('v')).toBe('p');

    await client.setBinding('Connection1-2.v', 'Connection1-2.o', true, true);
    expect(flow.getValue('v')).toEqual([{p: 'p'}]);

    let nextPromise = callbacks.promise;
    await client.setBinding('Connection1-2.v', null, true, true);
    expect(flow.getValue('v')).toBe(undefined);
    expect((await nextPromise).cache.bindingPath).toBeNull();

    await client.setBinding('Connection1-2.v', 'a', false, true);
    // clear binding but keep value (when it's primitive)
    await client.setBinding('Connection1-2.v', null, true, true);
    expect(flow.getValue('v')).toBe(3);

    // binding from global block
    let a = Root.instance._globalRoot.createBlock('^g');
    a.setValue('0', 'global');

    await client.setBinding('Connection1-2.v', '#global.^g.0', true, true);
    expect(flow.getValue('v')).toBe('global');
    expect(flow.getProperty('v')._bindingPath).toBe('^g.0');

    // clear #global
    callbacks.cancel();
    Root.instance._globalRoot._liveUpdate({});
    client.destroy();
    Root.instance.deleteValue('Connection1-2');
  });

  it('multiple subscribe binding', async function () {
    let flow = Root.instance.addFlow('Connection2');
    let [server, client] = makeLocalConnection(Root.instance, false);

    client.setBinding('Connection2.p', 'p0');

    let callbacks1 = new AsyncClientPromise();
    client.subscribe('Connection2.p', callbacks1);
    let result1 = await callbacks1.promise;
    expect(result1.change.value).toBeUndefined();
    expect(result1.change.bindingPath).toBe('p0');

    let callbacks2 = new AsyncClientPromise();
    client.subscribe('Connection2.p', callbacks2);
    let result2 = await callbacks2.firstPromise;
    expect(result1.change.bindingPath).toBe('p0');

    client.setValue('Connection2.p1', 'hello');
    client.setBinding('Connection2.p', 'p1');
    [result1, result2] = await Promise.all([callbacks1.promise, callbacks2.promise]);

    let callbacks3 = new AsyncClientPromise();
    client.subscribe('Connection2.p', callbacks3); // subscribe when local cache exists
    let result3 = await callbacks3.firstPromise;

    for (let obj of [result1.cache, result2.cache, result3.cache, result1.change, result2.change]) {
      expect(obj.value).toBe('hello');
      expect(obj.bindingPath).toBe('p1');
    }
    let cachedPromise1 = callbacks1.promise;

    client.unsubscribe('Connection2.p', callbacks3);
    client.unsubscribe('Connection2.p', callbacks2);
    client.unsubscribe('Connection2.p', callbacks1);

    client.setValue('Connection2.p2', 'world');
    await client.setBinding('Connection2.p', 'p2', false, true);
    expect(callbacks1.promise).toBe(cachedPromise1);
    expect(flow.getProperty('p')._listeners.size).toBe(0);

    // clean up
    callbacks1.cancel();
    callbacks2.cancel();
    callbacks3.cancel();
    client.destroy();
    Root.instance.deleteValue('Connection2');
  });

  it('watch', async function () {
    let flow = Root.instance.addFlow('Connection3-0');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let child0 = flow.createBlock('c0');

    let callbacks1 = new AsyncClientPromise();
    client.watch('Connection3-0', callbacks1);
    let result1 = await callbacks1.promise;
    expect(result1.changes).toEqual({c0: child0._blockId});
    expect(result1.cache).toEqual({c0: child0._blockId});

    flow.deleteValue('c0');
    let result2 = await callbacks1.promise;
    expect(result2.changes).toEqual({c0: null});

    let child1 = flow.createBlock('c1');
    let result3 = await callbacks1.promise;
    expect(result3.changes).toEqual({c1: child1._blockId});

    flow.deleteValue('c1');
    let result4 = await callbacks1.promise;
    expect(result4.changes).toEqual({c1: null});

    // clean up
    callbacks1.cancel();
    client.destroy();
    Root.instance.deleteValue('Connection3-0');
  });

  it('multiple watch', async function () {
    let flow = Root.instance.addFlow('Connection3');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let child0 = flow.createBlock('c0');

    let callbacks1 = new AsyncClientPromise();
    client.watch('Connection3', callbacks1);
    let result1 = await callbacks1.promise;
    expect(result1.changes).toEqual({c0: child0._blockId});
    expect(result1.cache).toEqual({c0: child0._blockId});

    let callbacks2 = new AsyncClientPromise();
    client.watch('Connection3', callbacks2);
    let result2 = await callbacks2.firstPromise;
    expect(result2.changes).toEqual({c0: child0._blockId});
    expect(result2.cache).toEqual({c0: child0._blockId});

    let child1 = flow.createBlock('c1');
    flow.createOutputBlock('t1'); // temp block shouldn't show in watch result
    [result1, result2] = await Promise.all([callbacks1.promise, callbacks2.promise]);
    expect(result1.changes).toEqual({c1: child1._blockId});
    expect(result1.cache).toEqual({c0: child0._blockId, c1: child1._blockId});
    expect(result2.changes).toEqual({c1: child1._blockId});
    expect(result2.cache).toEqual({c0: child0._blockId, c1: child1._blockId});

    client.setValue('Connection3.c0', null);
    result1 = await callbacks1.promise;
    expect(result1.changes).toEqual({c0: null});
    expect(result1.cache).toEqual({c1: child1._blockId});

    let cachedPromise1 = callbacks1.promise;

    client.unwatch('Connection3', callbacks2);
    client.unwatch('Connection3', callbacks1);

    await client.addBlock('Connection3.c2');
    expect(callbacks1.promise).toBe(cachedPromise1);
    expect(flow._watchers).toBeNull();

    // clean up
    callbacks1.cancel();
    callbacks2.cancel();
    client.destroy();
    Root.instance.deleteValue('Connection3');
  });

  it('list', async function () {
    let flow = Root.instance.addFlow('Connection4');
    let [server, client] = makeLocalConnection(Root.instance, false);

    for (let i = 0; i < 100; ++i) {
      flow.createBlock('a' + i);
      flow.createBlock('b' + i);
    }

    let result1 = await client.listChildren('Connection4', null, 32);
    expect(Object.keys(result1.children).length).toBe(32);
    expect(result1.count).toBe(200);

    let id2: string = client.listChildren('Connection4', 'any', 32, VoidListeners) as string;
    client.cancel(id2);

    let result3 = await client.listChildren('Connection4', 'a\\d+', 9999);
    expect(Object.keys(result3.children).length).toBe(16);
    expect(result3.count).toBe(100);

    client.destroy();
    Root.instance.deleteValue('Connection4');
  });

  it('watchDesc', async function () {
    let flow = Root.instance.addFlow('Connection5');
    let [server, client] = makeLocalConnection(Root.instance, true);

    let descCustom: FunctionDesc;
    client.watchDesc('Connection-watchDesc1', (desc: FunctionDesc) => {
      descCustom = desc;
    });

    let descResult1: FunctionDesc;
    client.watchDesc('add', (desc: FunctionDesc) => {
      descResult1 = desc;
    });
    await shouldHappen(() => descResult1 != null);

    expect(client.watchDesc('add')).not.toBeNull();

    // try it again
    let descResult2: FunctionDesc;
    client.watchDesc('add', (desc: FunctionDesc) => {
      descResult2 = desc;
    });
    await shouldHappen(() => descResult2 != null);

    expect(descCustom).toBeNull();
    JsFunction.registerType('this["out"] = 1', {
      name: 'Connection-watchDesc1',
    });
    await shouldHappen(() => descCustom != null);
    Functions.clear('Connection-watchDesc1');
    await shouldHappen(() => descCustom == null);

    expect(client.getCategory('math').color).toBe('4af');

    client.destroy();
    Root.instance.deleteValue('Connection5');
  });

  it('merge set request', async function () {
    TestFunctionRunner.clearLog();

    let flow = Root.instance.addFlow('Connection6');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let b = flow.createBlock('b');
    b.setValue('#mode', 'onCall');
    b.setValue('#sync', true);
    b.setValue('#-log', 0);
    b.setValue('#is', 'test-runner');

    let callbacks = new AsyncClientPromise();

    client.setValue('Connection6.b.#-log', 1);
    client.setValue('Connection6.b.#call', {});
    client.setValue('Connection6.b.#-log', 2, true);
    client.setValue('Connection6.b.#call', {}, callbacks);
    client.setValue('Connection6.b.#-log', 3);
    client.setValue('Connection6.b.#call', {});
    client.setValue('Connection6.b.#-log', 4);
    client.setValue('Connection6.b.#call', {});

    await callbacks.promise;

    expect(TestFunctionRunner.popLogs()).toEqual([2, 4]);
    client.destroy();
    Root.instance.deleteValue('Connection6');
  });

  it('merge update request', async function () {
    TestFunctionRunner.clearLog();

    let flow = Root.instance.addFlow('Connection6-2');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let b = flow.createBlock('b');
    b.updateValue('#mode', 'onCall');
    b.updateValue('#sync', true);
    b.updateValue('#-log', 0);
    b.updateValue('#is', 'test-runner');

    let callbacks = new AsyncClientPromise();

    client.updateValue('Connection6-2.b.#-log', 1);
    client.updateValue('Connection6-2.b.#call', {});
    client.updateValue('Connection6-2.b.#-log', 2, true);
    client.updateValue('Connection6-2.b.#call', {}, callbacks);
    client.updateValue('Connection6-2.b.#-log', 3);
    client.updateValue('Connection6-2.b.#call', {});
    client.updateValue('Connection6-2.b.#-log', 4);
    client.updateValue('Connection6-2.b.#call', {});

    await callbacks.promise;

    expect(TestFunctionRunner.popLogs()).toEqual([2, 4]);
    client.destroy();
    Root.instance.deleteValue('Connection6-2');
  });

  it('merge bind request', async function () {
    TestFunctionRunner.clearLog();

    let flow = Root.instance.addFlow('Connection6-3');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let b = flow.createBlock('b');
    b.setValue('@1', 1);
    b.setValue('@2', 2);
    b.setValue('@3', 3);
    b.setValue('@4', 4);

    b.setValue('#mode', 'onCall');
    b.setValue('#sync', true);
    b.setValue('#-log', 0);
    b.setValue('#is', 'test-runner');

    let callbacks = new AsyncClientPromise();

    client.setBinding('Connection6-3.b.#-log', '@1');
    client.setBinding('Connection6-3.b.#call', '@1');
    client.setBinding('Connection6-3.b.#-log', '@2', false, true);
    client.setBinding('Connection6-3.b.#call', '@2', false, callbacks);
    client.setBinding('Connection6-3.b.#-log', '@3');
    client.setBinding('Connection6-3.b.#call', '@3');
    client.setBinding('Connection6-3.b.#-log', '@4');
    client.setBinding('Connection6-3.b.#call', '@4');

    await callbacks.promise;

    expect(TestFunctionRunner.popLogs()).toEqual([2, 4]);
    client.destroy();
    Root.instance.deleteValue('Connection6-3');
  });

  it('subscribe listener', async function () {
    let flow = Root.instance.addFlow('Connection7');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let lastUpdate: DataMap;
    let callbacks = {
      onUpdate(response: DataMap) {
        lastUpdate = response;
      },
    };

    client.setValue('Connection7.v', 1);
    client.subscribe('Connection7.v', callbacks);
    await client.setBinding('Connection7.p', 'v', false, true);
    expect(lastUpdate.change.hasListener).toBe(true);
    await client.setBinding('Connection7.p', null, false, true);
    expect(lastUpdate.change.hasListener).toBe(false);
    client.unsubscribe('Connection7.v', callbacks);

    client.destroy();
    Root.instance.deleteValue('Connection7');
  });

  it('callImmediate', async function () {
    let flow = Root.instance.addFlow('Connection8');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let called = 0;
    let updated = 0;
    let callback = () => called++;

    client.callImmediate(callback);
    expect(called).toBe(1);

    let callbacks1 = {
      onUpdate(response: DataMap) {
        client.callImmediate(callback);
        updated++;
        expect(called).toBe(1);
      },
    };
    let callbacks2 = {
      onUpdate(response: DataMap) {
        client.callImmediate(callback);
        updated++;
        expect(called).toBe(1);
      },
    };
    client.setValue('Connection8.v', 1);
    client.subscribe('Connection8.v', callbacks1);
    client.subscribe('Connection8.v', callbacks2);

    expect(called).toBe(1);

    await shouldHappen(() => updated === 2 && called === 2);

    client.destroy();
    Root.instance.deleteValue('Connection8');
  });

  it('set a saved block', async function () {
    let flow = Root.instance.addFlow('Connection9');
    let [server, client] = makeLocalConnection(Root.instance, false);

    await client.setValue('Connection9.v', {'#is': 'hello'});

    let callbacks = new AsyncClientPromise();
    client.subscribe('Connection9.v', callbacks);
    let result = await callbacks.promise;
    expect(result.cache.value).toEqual({'#is': 'hello'});

    callbacks.cancel();

    client.destroy();
    Root.instance.deleteValue('Connection9');
  });

  it('auto bind', async function () {
    let flow1 = Root.instance.addFlow('Connection10');

    flow1.load({
      c: {
        '#is': '',
        'd': {'#is': ''},
        'e': {'#is': ''},
      },
      f: {
        '#is': '',
      },
    });

    let [server, client] = makeLocalConnection(Root.instance, false);

    client.setBinding('Connection10.c.e.v1', 'Connection10.c.d.v1', true);
    client.setBinding('Connection10.c.e.v2', 'Connection10.c.e.v1', true);
    client.setBinding('Connection10.c.e.v3', 'Connection10.f.v3', true);
    client.setBinding('Connection10.c.v4', 'Connection10.f.v4', true);

    await shouldHappen(() => flow1.queryProperty('c.e.v2', true)._bindingPath === 'v1');
    await shouldHappen(() => flow1.queryProperty('c.e.v1', true)._bindingPath === '##.d.v1');
    await shouldHappen(() => flow1.queryProperty('c.e.v3', true)._bindingPath === '###.f.v3');
    await shouldHappen(() => flow1.queryProperty('c.v4', true)._bindingPath === '##.f.v4');

    client.destroy();
    Root.instance.deleteValue('Connection10');
  });

  it('full value', async function () {
    let flow1 = Root.instance.addFlow('Connection11');

    flow1.load({
      '@v': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    });

    let [server, client] = makeLocalConnection(Root.instance, false);

    let callbacks1 = new AsyncClientPromise();
    client.subscribe('Connection11.@v', callbacks1);
    let result1 = await callbacks1.promise;

    expect(isDataTruncated(result1.cache.value)).toBe(true);

    let callbacks2 = new AsyncClientPromise();
    client.subscribe('Connection11.@v', callbacks2, true);
    let result2 = await callbacks2.promise;

    expect(isDataTruncated(result2.cache.value)).toBe(false);

    // callback1 should not receive a full update
    expect(isDataTruncated(callbacks1.lastResponse.cache.value)).toBe(true);

    callbacks1.cancel();
    callbacks2.cancel();

    client.destroy();
    Root.instance.deleteValue('Connection11');
  });

  it('helper property', async function () {
    let flow1 = Root.instance.addFlow('Connection12');

    let [server, client] = makeLocalConnection(Root.instance, false);

    await client.addBlock('Connection12.~a');

    expect(flow1.getValue('~a')).toBeInstanceOf(Block);
    expect(flow1.getProperty('a')._bindingPath).toBe('~a.#output');

    // transfer property value
    await client.setValue('Connection12.b', 2);
    await client.addBlock('Connection12.~b', {'#is': 'add'});
    expect(flow1.queryValue('~b.0')).toBe(2);

    // transfer property binding
    await client.setBinding('Connection12.c', '##.v');
    await client.addBlock('Connection12.~c', {'#is': 'add'});
    expect(flow1.queryProperty('~c.0')._bindingPath).toBe('##.##.v');

    client.destroy();
    Root.instance.deleteValue('Connection12');
  });

  it('autoName', async function () {
    let flow1 = Root.instance.addFlow('Connection13');

    let [server, client] = makeLocalConnection(Root.instance, false);

    let response1 = await client.addBlock('Connection13.a', null, true);
    let response2 = await client.addBlock('Connection13.a', null, true);
    let response3 = await client.addBlock('Connection13.a', null, true);

    // result names
    expect(response1.name).toBe('a');
    expect(response2.name).toBe('a1');
    expect(response3.name).toBe('a2');

    // a a0 a1 should all be created
    expect(flow1.getValue('a2')).toBeInstanceOf(Block);

    client.destroy();
    Root.instance.deleteValue('Connection13');
  });

  it('show hide move props', async function () {
    let flow1 = Root.instance.addFlow('Connection14');
    let block1 = flow1.createBlock('a');

    let [server, client] = makeLocalConnection(Root.instance, false);

    let response1 = await client.showProps('Connection14.a', ['@a', '@b']);
    expect(block1.getValue('@b-p')).toEqual(['@a', '@b']);

    let response2 = await client.moveShownProp('Connection14.a', '@a', '@b');
    expect(block1.getValue('@b-p')).toEqual(['@b', '@a']);

    let response3 = await client.hideProps('Connection14.a', ['@a', '@b']);
    expect(block1.getValue('@b-p')).not.toBeDefined();

    client.destroy();
    Root.instance.deleteValue('Connection14');
  });

  it('add remove custom props', async function () {
    let flow1 = Root.instance.addFlow('Connection15');
    let block1 = flow1.createBlock('a');

    let [server, client] = makeLocalConnection(Root.instance, false);

    let response1 = await client.addCustomProp('Connection15.a', {
      name: 'a',
      type: 'string',
    });
    expect(block1.getValue('#custom')).toEqual([{name: 'a', type: 'string'}]);

    let response2 = await client.removeCustomProp('Connection15.a', 'a');
    expect(block1.getValue('#custom')).not.toBeDefined();

    client.destroy();
    Root.instance.deleteValue('Connection15');
  });

  it('insert remove group props', async function () {
    let flow1 = Root.instance.addFlow('Connection16');
    let block1 = flow1.createBlock('a');
    block1._load({
      '#is': 'add',
      '0': 0,
      '1': 1,
    });

    let [server, client] = makeLocalConnection(Root.instance, false);

    let response1 = await client.insertGroupProp('Connection16.a', '', 0);
    expect(block1.getValue('[]')).toBe(3);
    expect(block1.getValue('1')).toBe(0);

    let response2 = await client.removeGroupProp('Connection16.a', '', 0);
    expect(block1.getValue('[]')).toBe(2);
    expect(block1.getValue('0')).toBe(0);

    let response3 = await client.moveGroupProp('Connection16.a', '', 0, 1);
    expect(block1.getValue('1')).toBe(0);

    client.destroy();
    Root.instance.deleteValue('Connection16');
  });

  it('set length', async function () {
    let flow1 = Root.instance.addFlow('Connection16-2');
    let block1 = flow1.createBlock('a');
    block1.setValue('#is', 'add');

    let [server, client] = makeLocalConnection(Root.instance, false);

    let response1 = await client.setLen('Connection16-2.a', '', 3);
    expect(block1.getValue('@b-p')).toEqual(['2']);

    client.destroy();
    Root.instance.deleteValue('Connection16-2');
  });

  it('move custom props', async function () {
    let flow1 = Root.instance.addFlow('Connection17');
    let block1 = flow1.createBlock('a');
    block1.setValue('#custom', [
      {name: 'a', type: 'string'},
      {name: 'b', type: 'string'},
    ]);

    let [server, client] = makeLocalConnection(Root.instance, false);

    let response1 = await client.moveCustomProp('Connection17.a', 'a', 'b');
    expect(block1.getValue('#custom')).toEqual([
      {name: 'b', type: 'string'},
      {name: 'a', type: 'string'},
    ]);

    client.destroy();
    Root.instance.deleteValue('Connection17');
  });

  it('findGlobalBlocks', async function () {
    let [server, client] = makeLocalConnection(Root.instance, true);

    let a = Root.instance._globalRoot.createBlock('^a');
    a.setValue('#is', 'add');
    let b = Root.instance._globalRoot.createBlock('^b');
    b.setValue('#is', 'subtract');

    await shouldHappen(() => client.findGlobalBlocks(['math']).length === 2);

    expect(client.findGlobalBlocks(['math-2'])).toEqual(['^b']);

    a.setValue('#is', 'subtract');
    await shouldHappen(() => client.findGlobalBlocks(['math-2']).length === 2);
    expect(client.findGlobalBlocks(['math-n'])).toEqual([]);

    // clear #global
    Root.instance._globalRoot._liveUpdate({});
    await shouldHappen(() => client.findGlobalBlocks(['math']).length === 0);

    client.destroy();
  });

  it('FlowEditor', async function () {
    let flow1 = Root.instance.addFlow('Connection18');
    let block1 = flow1.createBlock('a');
    let data = {
      '#is': '',
      'add': {'#is': 'add'},
    };

    let [server, client] = makeLocalConnection(Root.instance, true);

    // edit from field
    client.setValue('Connection18.a.use', data);
    await client.editWorker('Connection18.a.#edit-use', 'use');
    expect(block1.getValue('#edit-use').save()).toEqual(data);

    WorkerFunction.registerType(data, {name: 'func1'}, '');

    // edit from worker function
    await client.editWorker('Connection18.a.#edit-func1', null, ':func1');
    expect(block1.getValue('#edit-func1').save()).toEqual(data);

    Functions.clear(':func1');
    client.destroy();
    Root.instance.deleteValue('Connection18');
  });

  it('applyFlowChange', async function () {
    let flow1 = Root.instance.addFlow('Connection19');
    let [server, client] = makeLocalConnection(Root.instance, true);

    let editor = FlowEditor.create(flow1, '#edit-v', {}, null, false, (data: DataMap) => {
      flow1.setValue('v', data);
      return true;
    });
    await client.applyFlowChange('Connection19.#edit-v');
    expect(flow1.getValue('v')).toEqual({'#is': ''});

    client.destroy();
    Root.instance.deleteValue('Connection19');
  });

  it('createFlow and DeleteFlow', async function () {
    let [server, client] = makeLocalConnection(Root.instance, true);

    await client.addFlow('Connection20', {value: 123});
    expect(Root.instance.getValue('Connection20')).toBeInstanceOf(Flow);

    await client.addFlow('Connection20.subflow', {value: 123});
    expect(Root.instance.queryValue('Connection20.subflow')).toBeInstanceOf(Flow);

    await client.setValue('Connection20', undefined, true);
    expect(Root.instance.getValue('Connection20')).not.toBeDefined();

    client.destroy();
  });

  it('add remove move optional props', async function () {
    let flow1 = Root.instance.addFlow('Connection21');
    let block1 = flow1.createBlock('a');

    let [server, client] = makeLocalConnection(Root.instance, false);

    await client.addOptionalProp('Connection21.a', 'a');
    expect(block1.getValue('#optional')).toEqual(['a']);

    await client.addOptionalProp('Connection21.a', 'b');
    expect(block1.getValue('#optional')).toEqual(['a', 'b']);

    await client.moveOptionalProp('Connection21.a', 'a', 'b');
    expect(block1.getValue('#optional')).toEqual(['b', 'a']);

    await client.removeOptionalProp('Connection21.a', 'a');
    expect(block1.getValue('#optional')).toEqual(['b']);

    client.destroy();
    Root.instance.deleteValue('Connection21');
  });

  it('#shared #temp binding', async function () {
    let flow1 = Root.instance.createOutputFlow(WorkerFlow, 'Connection22', {
      '#is': '',
      'a': {'#is': ''},
      '#shared': {'#is': ''},
    });
    Root.instance.createOutputFlow(WorkerFlow, 'Connection22_2');

    let [server, client] = makeLocalConnection(Root.instance, false);

    await client.setBinding('Connection22.a.v', 'Connection22.#shared.a', true, true);
    expect(flow1.queryProperty('a.v')._bindingPath).toBe('##.#shared.a');

    await client.setBinding('Connection22.#shared.v', 'Connection22.#shared.a', true, true);
    expect(flow1.queryProperty('#shared.v')._bindingPath).toBe('a');

    // can't bind to different flow
    let error = await shouldReject(
      client.setBinding('Connection22_2.v1', 'Connection22.#shared.a', true, true) as Promise<any>
    );
    expect(error).toBe('invalid binding path');

    // can't bind into #shared
    error = await shouldReject(
      client.setBinding('Connection22.#shared.a', 'Connection22.v1', true, true) as Promise<any>
    );
    expect(error).toBe('invalid binding path');

    // can't bind from global #temp object
    error = await shouldReject(client.setBinding('Connection22_2.v2', '#temp.v', true, true) as Promise<any>);
    expect(error).toBe('invalid binding path');

    // can't bind to global #shared object
    error = await shouldReject(client.setBinding('#shared.v', 'Connection22_2.v', true, true) as Promise<any>);
    expect(error).toBe('invalid binding path');

    // can't bind to global #temp object
    error = await shouldReject(client.setBinding('#temp.v', 'Connection22_2.v', true, true) as Promise<any>);
    expect(error).toBe('invalid binding path');

    // binding to #shared is allowed only when it's from #global
    await client.setBinding('#temp.v', '#global.v', true, true);
    expect(Root.instance.queryProperty('#temp.v')._bindingPath).toBe('##.#global.v');

    client.destroy();
    client.setValue('#temp.v', undefined, true);
    Root.instance.deleteValue('Connection22');
    Root.instance.deleteValue('Connection22_2');
  });

  it('undo redo', async function () {
    let flow = Root.instance.addFlow('Connection23');
    flow.load({'#is': '', 'a': 1}, null, (data: any) => true);

    let [server, client] = makeLocalConnection(Root.instance, false);

    client.watch('Connection23', {});
    client.setValue('Connection23.a', 2);
    client.applyFlowChange('Connection23');
    await client.undo('Connection23');

    expect(flow.getValue('a')).toBe(1);

    await client.redo('Connection23');
    expect(flow.getValue('a')).toBe(2);

    client.destroy();
    Root.instance.deleteValue('Connection23');
  });

  it('copy paste', async function () {
    let flow = Root.instance.addFlow('Connection24');
    let data = {'#is': '', 'add': {'#is': 'add'}};
    flow.load(data);

    let [server, client] = makeLocalConnection(Root.instance, false);

    let copied = (await client.copy('Connection24', ['add'])).value;
    expect(copied).toEqual({add: {'#is': 'add'}});

    flow.deleteValue('add');

    expect((await client.paste('Connection24', copied)).pasted).toEqual(['add']);
    expect(flow.save()).toEqual(data);

    client.destroy();
    Root.instance.deleteValue('Connection24');
  });

  it('rename props', async function () {
    let flow = Root.instance.addFlow('Connection25');
    flow.setValue('a', 1);

    let [server, client] = makeLocalConnection(Root.instance, false);

    await client.renameProp('Connection25.a', 'b');

    expect(flow.getValue('a')).not.toBeDefined();
    expect(flow.getValue('b')).toBe(1);

    client.destroy();
    Root.instance.deleteValue('Connection25');
  });

  it('call function', async function () {
    let flow = Root.instance.addFlow('Connection26');
    let addBlock = flow.createBlock('add');
    addBlock._load({
      '#mode': 'onCall',
      '#is': 'add',
      '0': 1,
      '1': 2,
    });

    Root.run();
    expect(addBlock.getValue('#output')).not.toBeDefined();

    let [server, client] = makeLocalConnection(Root.instance, false);

    await client.callFunction('Connection26.add');
    Root.run();

    expect(addBlock.getValue('#output')).toBe(3);

    client.destroy();
    Root.instance.deleteValue('Connection26');
  });

  it('temp value and restoreSaved', async function () {
    // temp value (subscribed value not equal to saved value)
    let flow = Root.instance.addFlow('Connection27');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let callbacks = new AsyncClientPromise();
    client.subscribe('Connection27.a', callbacks);

    await client.setValue('Connection27.a', 2, true);
    client.updateValue('Connection27.a', 3, true);
    let result = await callbacks.promise;

    expect(flow.getProperty('a')._saved).toBe(2);
    expect(result.change.value).toBe(3);
    expect(result.change.temp).toBe(true);

    client.restoreSaved('Connection27.a');
    result = await callbacks.promise;
    expect(result.change.value).toBe(2);

    // clean up
    callbacks.cancel();
    client.destroy();
    Root.instance.deleteValue('Connection27');
  });
});
