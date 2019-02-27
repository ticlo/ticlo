import {assert} from "chai";
import SimulateEvent from "simulate-event";
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from "../../../../ui/util/test-util";
import {initEditor} from "../../../index";
import {StringEditor} from "../StringEditor";
import {shouldHappen} from "../../../../common/util/test-util";
import {blankPropDesc} from "../../../../common/block/Descriptor";
import {simulateInput} from "./simulate-input";

describe("StringEditor", function () {

  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
  });

  it('basic', async function () {
    let editor: StringEditor;
    let getRef = (e: StringEditor): void => {
      editor = e;
    };
    let value: string = null;
    let onChange = (str: string) => {
      value = str;
    };
    let [component, div] = loadTemplate(
      <StringEditor ref={getRef} value='1' desc={blankPropDesc} onChange={onChange}/>, 'editor');

    await shouldHappen(() => editor && div.querySelector('textarea.ant-input'));
    let input: HTMLTextAreaElement = div.querySelector('textarea.ant-input');

    simulateInput(editor, {key: 'A'}, 'A');
    assert.isNull(value);

    simulateInput(editor, {key: 'Enter'}, null);
    assert.equal(value, 'A');

    simulateInput(editor, {key: 'Enter', shiftKey: true}, 'A\n');
    assert.equal(value, 'A');

    simulateInput(editor, {key: 'Enter'}, null);
    assert.equal(value, 'A\n', 'shift enter for new line');

  });
});
