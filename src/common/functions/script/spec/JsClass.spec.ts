import {assert} from "chai";
import {Job, Root} from "../../../block/Block";
import {JsFunction} from "../Js";
import {Classes} from "../../../block/Class";

describe("Js Class", () => {

  it('basic', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');
    aBlock.setValue('in1', 321);
    aBlock.setValue('#is', 'Js-class1');

    JsFunction.registerClass('this["out1"] = this["in1"]', {id: 'Js-class1'});

    Root.run();
    assert.equal(aBlock.getValue('out1'), 321, 'basic script output');

  });

  it('unregister class', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');
    aBlock.setValue('#is', 'Js-class2');
    JsFunction.registerClass('this["out1"] = 1', {id: 'Js-class2'});

    assert(aBlock._queued, 'script is _queued');
    Classes.clear('Js-class2');
    Root.run();
    assert(!aBlock._queued, 'script is no longer _queued');
    assert.isUndefined(aBlock.getValue('out1'), 'clear class after called');
  });


  it('trivial', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');
    assert.isUndefined(Classes.listen('', aBlock), 'listen without class name');
  });
});
