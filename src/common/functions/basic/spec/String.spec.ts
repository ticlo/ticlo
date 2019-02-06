import {assert} from "chai";
import "../String";
import {Job, Root, Block} from "../../../block/Block";

describe("String", function () {

  it('basic join', function () {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', 'join');
    aBlock.setValue('0', 2);
    aBlock.setValue('1', 'a');

    Root.run();

    assert.equal(aBlock.getValue('output'), '2a');

    aBlock.setValue('0', null);

    Root.run();
    assert.equal(aBlock.getValue('output'), undefined);

    aBlock.setValue('0', ['b', 'c']);

    Root.run();
    assert.equal(aBlock.getValue('output'), 'bca');

    aBlock.setValue('separator', ',');

    Root.run();
    assert.equal(aBlock.getValue('output'), 'b,c,a');

    aBlock.setValue('#len', 1);

    Root.run();
    assert.equal(aBlock.getValue('output'), 'b,c');
  });
});
