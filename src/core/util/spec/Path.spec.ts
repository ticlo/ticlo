import {assert} from 'chai';
import {getRelativePath, resolvePath, forAllPathsBetween} from '../Path';
import {WorkerFunction} from '../../worker/WorkerFunction';
import {Root} from '../../block/Flow';
import {DataMap} from '../DataTypes';
import {propRelative} from '../PropPath';

describe('Path', function () {
  it('resolve', function () {
    assert.equal(resolvePath('a', 'b'), 'a.b');
    assert.equal(resolvePath('c.d.e', '##.f'), 'c.d.f');
    assert.equal(resolvePath('g.h', '#.i'), 'g.h.i');
    assert.equal(resolvePath('j', '##.##.k'), '##.k');
    assert.equal(resolvePath('l', '###.m'), '###.m');
    assert.equal(resolvePath('n', null), null);
  });

  it('relative', function () {
    assert.equal(getRelativePath('a', 'a'), '');

    assert.equal(getRelativePath('b.c', 'b.d'), '##.d');
  });

  it('forAllPathsBetween', function () {
    function getAllPathBetween(target: string, base: string): string[] {
      let result: string[] = [];
      forAllPathsBetween(target, base, (v) => result.push(v) === -1);
      return result;
    }

    assert.deepEqual(getAllPathBetween('a.b', 'c.d'), [], 'unrelated paths');
    assert.deepEqual(getAllPathBetween('e.f', 'e.f'), ['e.f'], 'same path');
    assert.deepEqual(getAllPathBetween('g.h.i.j.k', 'g.h'), ['g.h.i.j.k', 'g.h.i.j', 'g.h.i']);
  });

  it('propRelative', async function () {
    let flow1 = Root.instance.addFlow('PropRelative1');
    let flow2 = Root.instance.addFlow('PropRelative2');

    let flowData1: DataMap = {
      '#is': '',
      'A': {
        '#is': '',
        'B': {'#is': 'PropRelative:class2'},
      },
    };
    let flowData2: DataMap = {
      '#is': '',
      'C': {
        '#is': '',
        'D': {'#is': ''},
      },
    };
    WorkerFunction.registerType(flowData1, {name: 'class1'}, 'PropRelative');
    WorkerFunction.registerType(flowData2, {name: 'class2'}, 'PropRelative');

    flow1.load({
      c: {
        '#is': '',
        'd': {'#is': 'PropRelative:class1'},
        'e': {'#is': ''},
      },
      f: {
        '#is': '',
        '~g': {
          '#is': '',
        },
        'h': {'#is': 'PropRelative:class1'},
      },
    });

    flow2.load({
      o: {
        '#is': '',
        'p': {'#is': 'PropRelative:class1'},
        'q': {'#is': ''},
      },
    });

    Root.run();

    // same flow
    assert.equal(propRelative(flow1.queryValue('c.e'), flow1.queryProperty('c.e.v', true)), 'v');
    assert.equal(propRelative(flow1.queryValue('c.e'), flow1.queryProperty('c.d.v', true)), '##.d.v');
    assert.equal(propRelative(flow1.queryValue('c.e'), flow1.queryProperty('f.v', true)), '###.f.v');
    assert.equal(propRelative(flow1.queryValue('c'), flow1.queryProperty('f.v', true)), '##.f.v');
    assert.equal(
      propRelative(flow1.queryValue('f.~g'), flow1.queryProperty('c.v', true)),
      '##.##.c.v',
      'helper block should use ##'
    );

    // different flow
    assert.equal(propRelative(flow1.queryValue('c'), flow2.queryProperty('o.v', true)), '###.##.PropRelative2.o.v');
    assert.equal(propRelative(flow1.queryValue('c.d.#flow.A'), flow1.queryProperty('c.v', true)), '###.##.##.v');
    assert.equal(propRelative(flow1.queryValue('c'), flow1.queryProperty('c.d.#flow.A.v', true)), 'd.#flow.A.v');
    assert.equal(propRelative(flow1.queryValue('f'), flow1.queryProperty('c.d.#flow.A.v', true)), '##.c.d.#flow.A.v');
    assert.equal(
      propRelative(flow1.queryValue('f.h'), flow1.queryProperty('c.d.#flow.A.v', true)),
      '###.c.d.#flow.A.v'
    );
    assert.equal(
      propRelative(flow1.queryValue('c.d.#flow.A'), flow1.queryProperty('f.h.#flow.A.v', true)),
      '###.##.###.f.h.#flow.A.v'
    );
    assert.equal(
      propRelative(flow1.queryValue('c.d.#flow.A'), flow1.queryProperty('c.d.#flow.A.B.#flow.C.v', true)),
      'B.#flow.C.v'
    );

    let flow11 = Root.instance.addFlow('PropRelative1.1');
    let flow111 = Root.instance.addFlow('PropRelative1.1.1');
    let flow1c1 = Root.instance.addFlow('PropRelative1.c.1');

    assert.equal(propRelative(flow1.queryValue('1.1'), flow1.queryProperty('v', true)), '##.###.##.v');
    assert.equal(propRelative(flow1.queryValue('c.1'), flow1.queryProperty('v', true)), '##.###.v');

    Root.instance.deleteValue('PropRelative1');
    Root.instance.deleteValue('PropRelative2');
  });
});
