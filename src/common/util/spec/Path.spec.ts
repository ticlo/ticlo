import {assert} from "chai";
import {relative, resolve, forAllPathsBetween} from "../Path";


describe("Path", function () {

  it('resolve', function () {
    assert.equal(resolve('a', 'b'), 'a.b');

    assert.equal(resolve('c.d.e', '##.f'), 'c.d.f');

    assert.equal(resolve('g.h', '#.i'), 'g.h.i');

    assert.equal(resolve('j', '##.##.k'), '##.k');

    assert.equal(resolve('l', '###.m'), '###.m');
  });

  it('relative', function () {
    assert.equal(relative('a', 'a'), '');

    assert.equal(relative('b.c', 'b.d'), '##.d');
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

});
