import { assert } from "chai";
import "../Js";
import { Job, Root } from "../../../core/Job";

describe("Script", () => {
    it('basic', () => {
        let job = new Job();

        let aBlock = job.createBlock('a');

        aBlock.setValue('#class', 'js');
        aBlock.setValue('script', 'this["out1"] = 321');
        Root.run();

        assert.equal(aBlock.getValue('out1'), 321, 'basic script output');
    });

    it('nested function', () => {
        let job = new Job();

        let aBlock = job.createBlock('a');

        aBlock.setValue('#class', 'js');
        aBlock.setValue('script', 'return function(){this["out2"] = 456}');
        Root.run();

        assert.equal(aBlock.getValue('out2'), 456, 'basic script output');
    });
});
