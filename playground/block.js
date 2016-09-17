const Path = require('path');

let arglen = process.argv.length;

const assert = require('assert');

const Bz = require('../src/breezeflow.js');
const Block = Bz.Block;
const BlockRoot = Bz.BlockRoot;
const Loop = Bz.Loop;
const Types = Bz.Types;
const Add = Bz.Add;
const Subtract = Bz.Subtract;


var model = new BlockRoot();

let aBlock = model.createBlock('a');

aBlock.setValue('>>type', '+');
aBlock.setValue('>0', 2);
aBlock.setValue('>1', 3);

Loop.run();
assert.equal(aBlock.getValue('<out'), 5, '2+3 == 5');

aBlock.setValue('>0', 4);

Loop.run();
assert.equal(aBlock.getValue('<out'), 7, 'update parameter, 4+3 == 7');

aBlock = model.createBlock('a2');

aBlock.setValue('>0', 2.5);
aBlock.setValue('>1', 3.5);
aBlock.setValue('>>type', '+');

Loop.run();
assert.equal(aBlock.getValue('<out'), 6, 'update type after value, 2.5+3.5==6');


function r(strings, ...values) {
    console.log(strings.raw[0]);
    console.log(strings);
    console.log(values);
    return strings.raw[0];
}

let a = 123;
console.log(r`string t\"ext line 1 \ ${a+1} string text line${a+2}`);