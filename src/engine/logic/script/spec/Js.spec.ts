import * as assert from "assert";
import "../Js";
import { Job } from "../../../core/Job";
import { Loop } from "../../../core/Loop";

describe("Script", () => {
    it('basic', () => {
        let root = new Job();

        let aBlock = root.createBlock('a');

        aBlock.setValue('#class', 'js');
        aBlock.setValue('script', 'this["out1"] = 321');
        Loop.run();

        assert.equal(aBlock.getValue('out1'), 321, 'basic script output');
    });

    it('nested function', () => {
        let root = new Job();

        let aBlock = root.createBlock('a');

        aBlock.setValue('#class', 'js');
        aBlock.setValue('script', 'return function(){this["out2"] = 456}');
        Loop.run();

        assert.equal(aBlock.getValue('out2'), 456, 'basic script output');
    });
});
