import {assert} from "chai";
import {Uid} from '../Uid';

describe("Uid", function () {

  it('uid', function () {
    let uid = new Uid();

    assert.equal(uid.current, '0', 'initial value');
    assert.equal(uid.next(), '1', 'next value');

    uid._count = Number.MAX_SAFE_INTEGER - 1;
    assert.equal(uid.next(), '0-0', 'create prefix when max safe int reached');

    uid._count = Number.MAX_SAFE_INTEGER - 1;
    assert.equal(uid.next(), '1-0', 'add prefix when max safe int reached');

    uid._count = Number.MAX_SAFE_INTEGER - 1;
    uid._prefix._count = Number.MAX_SAFE_INTEGER - 1;
    assert.equal(uid.next(), '0-0-0', 'multi-prefix when max safe int reached');
  });

});
