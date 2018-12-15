import {assert} from "chai";
import {relative, resolve, allPathsBetween} from "../Path";


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

  it('allPathsBetween', function () {
    assert.deepEqual(allPathsBetween('a.b', 'c.d'), [], 'unrelated paths');
    assert.deepEqual(allPathsBetween('e.f', 'e.f'), [], 'same path');
    assert.deepEqual(allPathsBetween('g.h.i.j.k', 'g.h'), ['g.h.i.j', 'g.h.i']);
  });

});
