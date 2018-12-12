import {assert} from "chai";
import {relative, resolve} from "../Path";


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

});
