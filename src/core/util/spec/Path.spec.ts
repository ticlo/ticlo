import {assert} from 'chai';
import {getRelativePath, resolvePath, forAllPathsBetween} from '../Path';
import {WorkerFunction} from '../../worker/WorkerFunction';
import {Root} from '../../block/Job';
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
    let job1 = Root.instance.addJob('PropRelative1');
    let job2 = Root.instance.addJob('PropRelative2');

    let jobData1: DataMap = {
      '#is': '',
      'A': {
        '#is': '',
        'B': {'#is': 'PropRelative:class2'},
      },
    };
    let jobData2: DataMap = {
      '#is': '',
      'C': {
        '#is': '',
        'D': {'#is': ''},
      },
    };
    WorkerFunction.registerType(jobData1, {name: 'class1'}, 'PropRelative');
    WorkerFunction.registerType(jobData2, {name: 'class2'}, 'PropRelative');

    job1.load({
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

    job2.load({
      o: {
        '#is': '',
        'p': {'#is': 'PropRelative:class1'},
        'q': {'#is': ''},
      },
    });

    Root.run();

    // same job
    assert.equal(propRelative(job1.queryValue('c.e'), job1.queryProperty('c.e.v', true)), 'v');
    assert.equal(propRelative(job1.queryValue('c.e'), job1.queryProperty('c.d.v', true)), '##.d.v');
    assert.equal(propRelative(job1.queryValue('c.e'), job1.queryProperty('f.v', true)), '###.f.v');
    assert.equal(propRelative(job1.queryValue('c'), job1.queryProperty('f.v', true)), '##.f.v');
    assert.equal(
      propRelative(job1.queryValue('f.~g'), job1.queryProperty('c.v', true)),
      '##.##.c.v',
      'helper block should use ##'
    );

    // different job
    assert.equal(propRelative(job1.queryValue('c'), job2.queryProperty('o.v', true)), '###.##.PropRelative2.o.v');
    assert.equal(propRelative(job1.queryValue('c.d.#func.A'), job1.queryProperty('c.v', true)), '###.##.##.v');
    assert.equal(propRelative(job1.queryValue('c'), job1.queryProperty('c.d.#func.A.v', true)), 'd.#func.A.v');
    assert.equal(propRelative(job1.queryValue('f'), job1.queryProperty('c.d.#func.A.v', true)), '##.c.d.#func.A.v');
    assert.equal(propRelative(job1.queryValue('f.h'), job1.queryProperty('c.d.#func.A.v', true)), '###.c.d.#func.A.v');
    assert.equal(
      propRelative(job1.queryValue('c.d.#func.A'), job1.queryProperty('f.h.#func.A.v', true)),
      '###.##.###.f.h.#func.A.v'
    );
    assert.equal(
      propRelative(job1.queryValue('c.d.#func.A'), job1.queryProperty('c.d.#func.A.B.#func.C.v', true)),
      'B.#func.C.v'
    );

    let job11 = Root.instance.addJob('PropRelative1.1');
    let job111 = Root.instance.addJob('PropRelative1.1.1');
    let job1c1 = Root.instance.addJob('PropRelative1.c.1');

    assert.equal(propRelative(job1.queryValue('1.1'), job1.queryProperty('v', true)), '##.###.##.v');
    assert.equal(propRelative(job1.queryValue('c.1'), job1.queryProperty('v', true)), '##.###.v');

    Root.instance.deleteValue('PropRelative1');
    Root.instance.deleteValue('PropRelative2');
  });
});
