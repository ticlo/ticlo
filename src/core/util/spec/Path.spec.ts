import {expect} from 'vitest';
import {getRelativePath, resolvePath, forAllPathsBetween} from '../Path';
import {WorkerFunction} from '../../worker/WorkerFunction';
import {Root} from '../../block/Flow';
import {DataMap} from '../DataTypes';
import {propRelative} from '../PropPath';
import {Block} from '../../block/Block';

describe('Path', function () {
  it('resolve', function () {
    expect(resolvePath('a', 'b')).toBe('a.b');
    expect(resolvePath('c.d.e', '##.f')).toBe('c.d.f');
    expect(resolvePath('g.h', '#.i')).toBe('g.h.i');
    expect(resolvePath('j', '##.##.k')).toBe('##.k');
    expect(resolvePath('l', '###.m')).toBe('###.m');
    expect(resolvePath('n', null)).toBe(null);
  });

  it('relative', function () {
    expect(getRelativePath('a', 'a')).toBe('');

    expect(getRelativePath('b.c', 'b.d')).toBe('##.d');
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
    expect(propRelative(flow1.queryValue('c.e') as Block, flow1.queryProperty('c.e.v', true))).toBe('v');
    expect(propRelative(flow1.queryValue('c.e') as Block, flow1.queryProperty('c.d.v', true))).toBe('##.d.v');
    expect(propRelative(flow1.queryValue('c.e') as Block, flow1.queryProperty('f.v', true))).toBe('###.f.v');
    expect(propRelative(flow1.queryValue('c') as Block, flow1.queryProperty('f.v', true))).toBe('##.f.v');
    expect(propRelative(flow1.queryValue('f.~g') as Block, flow1.queryProperty('c.v', true))).toBe('##.##.c.v');

    // different flow
    expect(propRelative(flow1.queryValue('c') as Block, flow2.queryProperty('o.v', true))).toBe(
      '###.##.PropRelative2.o.v'
    );
    expect(propRelative(flow1.queryValue('c.d.#flow.A') as Block, flow1.queryProperty('c.v', true))).toBe(
      '###.##.##.v'
    );
    expect(propRelative(flow1.queryValue('c') as Block, flow1.queryProperty('c.d.#flow.A.v', true))).toBe(
      'd.#flow.A.v'
    );
    expect(propRelative(flow1.queryValue('f') as Block, flow1.queryProperty('c.d.#flow.A.v', true))).toBe(
      '##.c.d.#flow.A.v'
    );
    expect(propRelative(flow1.queryValue('f.h') as Block, flow1.queryProperty('c.d.#flow.A.v', true))).toEqual(
      '###.c.d.#flow.A.v'
    );
    expect(propRelative(flow1.queryValue('c.d.#flow.A') as Block, flow1.queryProperty('f.h.#flow.A.v', true))).toEqual(
      '###.##.###.f.h.#flow.A.v'
    );
    expect(
      propRelative(flow1.queryValue('c.d.#flow.A') as Block, flow1.queryProperty('c.d.#flow.A.B.#flow.C.v', true))
    ).toEqual('B.#flow.C.v');

    let flow11 = Root.instance.addFlow('PropRelative1.1');
    let flow111 = Root.instance.addFlow('PropRelative1.1.1');
    let flow1c1 = Root.instance.addFlow('PropRelative1.c.1');

    expect(propRelative(flow1.queryValue('1.1') as Block, flow1.queryProperty('v', true))).toBe('##.###.##.v');
    expect(propRelative(flow1.queryValue('c.1') as Block, flow1.queryProperty('v', true))).toBe('##.###.v');

    Root.instance.deleteValue('PropRelative1');
    Root.instance.deleteValue('PropRelative2');
  });
});
