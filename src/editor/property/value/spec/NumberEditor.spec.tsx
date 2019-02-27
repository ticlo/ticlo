import {assert} from "chai";
import SimulateEvent from "simulate-event";
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from "../../../../ui/util/test-util";
import {initEditor} from "../../../index";
import {NumberEditor} from "../NumberEditor";
import {shouldHappen} from "../../../../common/util/test-util";
import {blankPropDesc, FunctionDesc, PropDesc} from "../../../../common/block/Descriptor";
import {simulateInput} from "./simulate-input";

describe("NumberEditor", function () {

  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
  });

  it('basic', async function () {
    let editor: NumberEditor;
    let getRef = (e: NumberEditor): void => {
      editor = e;
    };
    let value: number = null;
    let onChange = (n: number) => {
      value = n;
    };
    let [component, div] = loadTemplate(
      <NumberEditor ref={getRef} value={1} desc={blankPropDesc} onChange={onChange}/>, 'editor');

    await shouldHappen(() => editor && div.querySelector('input.ant-input'));

    simulateInput(editor, {key: '2'}, '2');
    assert.isNull(value);

    simulateInput(editor, {key: 'Enter'}, null);
    assert.equal(value, 2);

    // test escape key
    simulateInput(editor, {key: '3'}, '23');
    assert.equal(value, 2);

    simulateInput(editor, {key: 'Escape'}, null);
    simulateInput(editor, {key: 'Enter'}, null);
    assert.equal(value, 1); // blur back to the value from Props

    // onBlur
    simulateInput(editor, {key: '4'}, '234');
    assert.notEqual(value, 234);

    editor.onBlur();
    assert.equal(value, 234);

    // arrow key
    simulateInput(editor, {key: '1'}, '11');
    simulateInput(editor, {key: 'ArrowUp'}, null);
    assert.equal(value, 12);

    simulateInput(editor, {key: '1'}, '11');
    simulateInput(editor, {key: 'ArrowUp', shiftKey: true}, null);
    assert.equal(value, 21);

    simulateInput(editor, {key: '1'}, '11');
    simulateInput(editor, {key: 'ArrowDown'}, null);
    assert.equal(value, 10);

    simulateInput(editor, {key: '1'}, '11');
    simulateInput(editor, {key: 'ArrowDown', shiftKey: true}, null);
    assert.equal(value, 1);

    // enter forumla
    simulateInput(editor, {key: '1'}, '1+1');
    simulateInput(editor, {key: 'Enter', shiftKey: true}, null);
    assert.equal(value, 2);

    simulateInput(editor, {key: 'a'}, 'a');
    simulateInput(editor, {key: 'Enter', shiftKey: true}, null);
    assert.equal(value, 2); // not changed

    // invalid input
    simulateInput(editor, {key: 'a'}, 'a');
    simulateInput(editor, {key: 'Enter'}, null);
    assert.equal(value, 2); // not changed
  });


  it('constraint', async function () {
    let editor: NumberEditor;
    let getRef = (e: NumberEditor): void => {
      editor = e;
    };
    let value: number = null;
    let onChange = (n: number) => {
      value = n;
    };
    let desc: PropDesc = {
      name: '',
      type: 'number',
      max: 10,
      min: 1,
      step: 1,
    };
    let [component, div] = loadTemplate(
      <NumberEditor ref={getRef} value={1} desc={desc} onChange={onChange}/>, 'editor');

    await shouldHappen(() => editor && div.querySelector('input.ant-input'));

    // test step
    simulateInput(editor, {key: '2'}, '5.2');
    simulateInput(editor, {key: 'Enter'}, null);
    assert.equal(value, 5);

    // test max
    simulateInput(editor, {key: '3'}, '13');
    simulateInput(editor, {key: 'Enter'}, null);
    assert.equal(value, 10);

    // test min
    simulateInput(editor, {key: '0'}, '0');
    simulateInput(editor, {key: 'Enter'}, null);
    assert.equal(value, 1);

  });
});
