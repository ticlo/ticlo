import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from '../../../util/test-util.js';
import {initEditor} from '../../../index.js';
import {NumberEditor} from '../NumberEditor.js';
import {shouldHappen} from '@ticlo/core/util/test-util.js';
import {blankFuncDesc, blankPropDesc, FunctionDesc, PropDesc} from '@ticlo/core';
import {simulateInput} from './simulate-input.js';
import {DateEditor} from '../DateEditor.js';

describe('NumberEditor', function () {
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
      <NumberEditor ref={getRef} value={1} funcDesc={blankFuncDesc} desc={blankPropDesc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => editor && div.querySelector('input.ant-input'));

    simulateInput(editor, {key: '2'}, '2');
    expect(value).toBeNull();

    simulateInput(editor, {key: 'Enter'}, null);
    expect(value).toBe(2);

    // test escape key
    simulateInput(editor, {key: '3'}, '23');
    expect(value).toBe(2);

    simulateInput(editor, {key: 'Escape'}, null);
    simulateInput(editor, {key: 'Enter'}, null);
    expect(value).toBe(1); // blur back to the value from Props

    // onBlur
    simulateInput(editor, {key: '4'}, '234');
    expect(value).not.toBe(234);

    editor.onBlur();
    expect(value).toBe(234);

    // arrow key
    simulateInput(editor, {key: '1'}, '11');
    simulateInput(editor, {key: 'ArrowUp'}, null);
    expect(value).toBe(12);

    simulateInput(editor, {key: '1'}, '11');
    simulateInput(editor, {key: 'ArrowUp', shiftKey: true}, null);
    expect(value).toBe(21);

    simulateInput(editor, {key: '1'}, '11');
    simulateInput(editor, {key: 'ArrowDown'}, null);
    expect(value).toBe(10);

    simulateInput(editor, {key: '1'}, '11');
    simulateInput(editor, {key: 'ArrowDown', shiftKey: true}, null);
    expect(value).toBe(1);

    // enter forumla
    simulateInput(editor, {key: ')'}, 'sin(0)');
    simulateInput(editor, {key: 'Enter', shiftKey: true}, null);
    expect(value).toBe(0);

    // enter forumla
    simulateInput(editor, {key: ')'}, 'acos(0)');
    simulateInput(editor, {key: 'Enter', shiftKey: true}, null);
    expect(value).toBe(90);

    simulateInput(editor, {key: 'a'}, 'a');
    simulateInput(editor, {key: 'Enter', shiftKey: true}, null);
    expect(value).toBe(90); // not changed

    // invalid input
    simulateInput(editor, {key: 'a'}, 'a');
    simulateInput(editor, {key: 'Enter'}, null);
    expect(value).toBe(90); // not changed
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
      min: 2,
      step: 2,
    };
    let [component, div] = loadTemplate(
      <NumberEditor ref={getRef} value={6} funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => editor && div.querySelector('input.ant-input'));

    // test step
    simulateInput(editor, {key: '2'}, '4.2');
    simulateInput(editor, {key: 'Enter'}, null);
    expect(value).toBe(4);

    // test max
    simulateInput(editor, {key: '3'}, '13');
    simulateInput(editor, {key: 'Enter'}, null);
    expect(value).toBe(10);

    // test min
    simulateInput(editor, {key: '0'}, '0');
    simulateInput(editor, {key: 'Enter'}, null);
    expect(value).toBe(2);

    simulateInput(editor, {key: '6'}, '6');
    simulateInput(editor, {key: 'ArrowUp'}, null);
    expect(value).toBe(8);

    simulateInput(editor, {key: '6'}, '6');
    simulateInput(editor, {key: 'ArrowDown'}, null);
    expect(value).toBe(4);
  });
});
