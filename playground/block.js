var assert = require('assert');

const Block = require('../lib/core/Block').Block;
const BlockRoot = require('../lib/core/BlockRoot').BlockRoot;
const Loop = require('../lib/core/Loop').Loop;
const Types = require('../lib/core/Types').Types;
const Add = require('../lib/logic/basic/Add').Add;



var model = new BlockRoot();

let addBlock = model.createBlock('add');


addBlock.setValue('>0', 2);
addBlock.setValue('>1', 3);

addBlock.setValue('>>type', '+');

Loop.run();
console.log("out->" + addBlock.getValue('<out'));
