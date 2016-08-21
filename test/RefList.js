'use strict';

const assert = require('assert');

const Bz = require('../src/breezeflow.js');
const RefList = Bz.RefList;

describe("RefList", function () {
    it('iteration', function () {
        /** @type {RefList<int>} */
        let list = new RefList();
        /** @type {Array<RefListRef<int>>} */
        let nodes = [];
        for (let i = 0; i < 5; ++i) {
            nodes.push(list.addValue(i));
        }
        let expected = 0;
        list.forEach(function (val) {
            assert.equal(val, expected, "forEach");
            expected++;
        });
        expected = 0;
        list.forEachRef(function (node) {
            assert.equal(node.value, expected, "forEachRef");
            expected++;
        });

        expected = 0;
        list.forEachRef(function (node) {
            assert.equal(node.value, expected, "forEachRef Remove");
            node.remove();
            expected++;
        });
        assert(list.isEmpty(), "list empty after remove");
        for (let i = 0; i < 5; ++i) {
            assert(nodes[i]._list == null, "node has no list after remove");
        }
    });
    it('addValue remove during iteration 1', function () {
        /** @type {RefList<int>} */
        let list = new RefList();
        /** @type {Array<RefListRef<int>>} */
        let nodes = [];
        for (let i = 0; i < 10; ++i) {
            nodes.push(list.addValue(i));
        }

        let removeOrder = [0, 3, 2, 4, 7, 1, 9];
        let expectedValues = [0, 1, 2, 4, 5, 6, 8];
        let expectedIdx = 0;
        list.forEach(function (val) {
            assert.equal(val, expectedValues[expectedIdx], "forEachRef random Remove Add");
            nodes[removeOrder[expectedIdx]].remove();
            list.addValue(expectedIdx + 10);
            expectedIdx++;
        });

        expectedIdx = 0;
        expectedValues = [5, 6, 8, 10, 11, 12, 13, 14, 15, 16];
        list.forEach(function (val) {
            assert.equal(val, expectedValues[expectedIdx], "forEachRef random Remove Add");
            expectedIdx++;
        });

    });

    it('addValue remove during iteration 2', function () {
        /** @type {RefList<int>} */
        let list = new RefList();
        /** @type {Array<RefListRef<int>>} */
        let nodes = [];
        for (let i = 0; i < 10; ++i) {
            nodes.push(list.addValue(i));
        }

        let removeOrder = [0, 3, 2, 4, 7, 9, 8]; // different order to check the last value
        let expectedValues = [0, 1, 2, 4, 5, 6, 8];
        let expectedIdx = 0;
        list.forEach(function (val) {
            assert.equal(val, expectedValues[expectedIdx], "forEachRef random Remove Add");
            nodes[removeOrder[expectedIdx]].remove();
            list.addValue(expectedIdx + 10);
            expectedIdx++;
        });

        expectedIdx = 0;
        expectedValues = [1, 5, 6, 10, 11, 12, 13, 14, 15, 16];
        list.forEach(function (val) {
            assert.equal(val, expectedValues[expectedIdx], "forEachRef random Remove Add");
            expectedIdx++;
        });

    });
});