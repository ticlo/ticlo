import expect from 'expect';
import SimulateEvent from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from '../../../util/test-util';
import {initEditor} from '../../../index';
import {NumberEditor} from '../NumberEditor';
import {shouldHappen} from '../../../../../src/core/util/test-util';
import {blankFuncDesc, blankPropDesc, FunctionDesc, PropDesc} from '../../../../../src/core/editor';
import {simulateInput} from './simulate-input';
import {DateEditor} from '../DateEditor';

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
    expect(value).toEqual(2);

    // test escape key
    simulateInput(editor, {key: '3'}, '23');
    expect(value).toEqual(2);

    simulateInput(editor, {key: 'Escape'}, null);
    simulateInput(editor, {key: 'Enter'}, null);
    expect(value).toEqual(1); // blur back to the value from Props

    // onBlur
    simulateInput(editor, {key: '4'}, '234');
    expect(value).not.toEqual(234);

    editor.onBlur();
    expect(value).toEqual(234);

    // arrow key
    simulateInput(editor, {key: '1'}, '11');
    simulateInput(editor, {key: 'ArrowUp'}, null);
    expect(value).toEqual(12);

    simulateInput(editor, {key: '1'}, '11');
    simulateInput(editor, {key: 'ArrowUp', shiftKey: true}, null);
    expect(value).toEqual(21);

    simulateInput(editor, {key: '1'}, '11');
    simulateInput(editor, {key: 'ArrowDown'}, null);
    expect(value).toEqual(10);

    simulateInput(editor, {key: '1'}, '11');
    simulateInput(editor, {key: 'ArrowDown', shiftKey: true}, null);
    expect(value).toEqual(1);

    // enter forumla
    simulateInput(editor, {key: ')'}, 'sin(0)');
    simulateInput(editor, {key: 'Enter', shiftKey: true}, null);
    expect(value).toEqual(0);

    // enter forumla
    simulateInput(editor, {key: ')'}, 'acos(0)');
    simulateInput(editor, {key: 'Enter', shiftKey: true}, null);
    expect(value).toEqual(90);

    simulateInput(editor, {key: 'a'}, 'a');
    simulateInput(editor, {key: 'Enter', shiftKey: true}, null);
    expect(value).toEqual(90); // not changed

    // invalid input
    simulateInput(editor, {key: 'a'}, 'a');
    simulateInput(editor, {key: 'Enter'}, null);
    expect(value).toEqual(90); // not changed
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
    expect(value).toEqual(4);

    // test max
    simulateInput(editor, {key: '3'}, '13');
    simulateInput(editor, {key: 'Enter'}, null);
    expect(value).toEqual(10);

    // test min
    simulateInput(editor, {key: '0'}, '0');
    simulateInput(editor, {key: 'Enter'}, null);
    expect(value).toEqual(2);

    simulateInput(editor, {key: '6'}, '6');
    simulateInput(editor, {key: 'ArrowUp'}, null);
    expect(value).toEqual(8);

    simulateInput(editor, {key: '6'}, '6');
    simulateInput(editor, {key: 'ArrowDown'}, null);
    expect(value).toEqual(4);
  });
});
