import {expect} from 'vitest';
import {getRelativePath, resolvePath, forAllPathsBetween, encodeFileName} from '../Path.js';
import {WorkerFunctionGen} from '../../worker/WorkerFunctionGen.js';
import type {FlowFolder} from '../../block/Flow.js';
import { Root} from '../../block/Flow.js';
import type {DataMap} from '../DataTypes.js';
import {propRelative} from '../PropPath.js';
import type {Block} from '../../block/Block.js';

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

  it('encodeFileName', function () {
    expect(encodeFileName('\\/?*:|"<>')).toBe('%5c%2f%3f%2a%3a%7c%22%3c%3e');
    expect(encodeFileName('\u0001')).toBe('%01');
    expect(encodeFileName('周1A')).toBe('周1A');
  });

  it('forAllPathsBetween', function () {
    function getAllPathBetween(target: string, base: string): string[] {
      const result: string[] = [];
      forAllPathsBetween(target, base, (v) => result.push(v) === -1);
      return result;
    }

    expect(getAllPathBetween('a.b', 'c.d')).toEqual([]);
    expect(getAllPathBetween('e.f', 'e.f')).toEqual(['e.f']);
    expect(getAllPathBetween('g.h.i.j.k', 'g.h')).toEqual(['g.h.i.j.k', 'g.h.i.j', 'g.h.i']);
  });

  it('propRelative', async function () {
    const flow1 = Root.instance.addFlow('PropRelative1');
    const flow2 = Root.instance.addFlow('PropRelative2');

    const flowData1: DataMap = {
      '#is': '',
      'A': {
        '#is': '',
        'B': {'#is': 'PropRelative:class2'},
      },
    };
    const flowData2: DataMap = {
      '#is': '',
      'C': {
        '#is': '',
        'D': {'#is': ''},
      },
    };
    WorkerFunctionGen.registerType(flowData1, {name: 'class1'}, 'PropRelative');
    WorkerFunctionGen.registerType(flowData2, {name: 'class2'}, 'PropRelative');

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

    const flow111 = Root.instance.addFlow('FolderRelative1.1.1', null, null, true);
    const folder1 = Root.instance.getValue('FolderRelative1') as FlowFolder;

    expect(propRelative(folder1.queryValue('1.1') as Block, folder1.queryProperty('v', true))).toBe('#lib.v');

    Root.instance.deleteValue('PropRelative1');
    Root.instance.deleteValue('PropRelative2');
    Root.instance.deleteValue('FolderRelative1');
  });
});
