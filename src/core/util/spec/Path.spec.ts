import expect from 'expect';
import {getRelativePath, resolvePath, forAllPathsBetween} from '../Path';
import {WorkerFunction} from '../../worker/WorkerFunction';
import {Root} from '../../block/Flow';
import {DataMap} from '../DataTypes';
import {propRelative} from '../PropPath';

describe('Path', function () {
  it('resolve', function () {
    expect(resolvePath('a', 'b')).toEqual('a.b');
    expect(resolvePath('c.d.e', '##.f')).toEqual('c.d.f');
    expect(resolvePath('g.h', '#.i')).toEqual('g.h.i');
    expect(resolvePath('j', '##.##.k')).toEqual('##.k');
    expect(resolvePath('l', '###.m')).toEqual('###.m');
    expect(resolvePath('n', null)).toEqual(null);
  });

  it('relative', function () {
    expect(getRelativePath('a', 'a')).toEqual('');

    expect(getRelativePath('b.c', 'b.d')).toEqual('##.d');
  });

  it('forAllPathsBetween', function () {
    function getAllPathBetween(target: string, base: string): string[] {
      let result: string[] = [];
      forAllPathsBetween(target, base, (v) => result.push(v) === -1);
      return result;
    }

    expect(getAllPathBetween('a.b', 'c.d')).toEqual([]);
    expect(getAllPathBetween('e.f', 'e.f')).toEqual(['e.f']);
    expect(getAllPathBetween('g.h.i.j.k', 'g.h')).toEqual(['g.h.i.j.k', 'g.h.i.j', 'g.h.i']);
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
    expect(propRelative(flow1.queryValue('c.e'), flow1.queryProperty('c.e.v', true))).toEqual('v');
    expect(propRelative(flow1.queryValue('c.e'), flow1.queryProperty('c.d.v', true))).toEqual('##.d.v');
    expect(propRelative(flow1.queryValue('c.e'), flow1.queryProperty('f.v', true))).toEqual('###.f.v');
    expect(propRelative(flow1.queryValue('c'), flow1.queryProperty('f.v', true))).toEqual('##.f.v');
    expect(propRelative(flow1.queryValue('f.~g'), flow1.queryProperty('c.v', true))).toEqual('##.##.c.v');

    // different flow
    expect(propRelative(flow1.queryValue('c'), flow2.queryProperty('o.v', true))).toEqual('###.##.PropRelative2.o.v');
    expect(propRelative(flow1.queryValue('c.d.#flow.A'), flow1.queryProperty('c.v', true))).toEqual('###.##.##.v');
    expect(propRelative(flow1.queryValue('c'), flow1.queryProperty('c.d.#flow.A.v', true))).toEqual('d.#flow.A.v');
    expect(propRelative(flow1.queryValue('f'), flow1.queryProperty('c.d.#flow.A.v', true))).toEqual('##.c.d.#flow.A.v');
    expect(propRelative(flow1.queryValue('f.h'), flow1.queryProperty('c.d.#flow.A.v', true))).toEqual(
      '###.c.d.#flow.A.v'
    );
    expect(propRelative(flow1.queryValue('c.d.#flow.A'), flow1.queryProperty('f.h.#flow.A.v', true))).toEqual(
      '###.##.###.f.h.#flow.A.v'
    );
    expect(propRelative(flow1.queryValue('c.d.#flow.A'), flow1.queryProperty('c.d.#flow.A.B.#flow.C.v', true))).toEqual(
      'B.#flow.C.v'
    );

    let flow11 = Root.instance.addFlow('PropRelative1.1');
    let flow111 = Root.instance.addFlow('PropRelative1.1.1');
    let flow1c1 = Root.instance.addFlow('PropRelative1.c.1');

    expect(propRelative(flow1.queryValue('1.1'), flow1.queryProperty('v', true))).toEqual('##.###.##.v');
    expect(propRelative(flow1.queryValue('c.1'), flow1.queryProperty('v', true))).toEqual('##.###.v');

    Root.instance.deleteValue('PropRelative1');
    Root.instance.deleteValue('PropRelative2');
  });
});
