import expect from 'expect';
import SimulateEvent from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from '../../../util/test-util';
import {initEditor} from '../../../index';
import {PasswordEditor} from '../PasswordEditor';
import {shouldHappen} from '../../../../../src/core/util/test-util';
import {blankFuncDesc, blankPropDesc} from '../../../../../src/core/editor';
import {simulateInput} from './simulate-input';
import {DateEditor} from '../DateEditor';

describe('PasswordEditor', function () {
  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
  });

  it('basic', async function () {
    let editor: PasswordEditor;
    let getRef = (e: PasswordEditor): void => {
      editor = e;
    };
    let value: string = null;
    let onChange = (str: string) => {
      value = str;
    };
    let [component, div] = loadTemplate(
      <PasswordEditor ref={getRef} value="1" funcDesc={blankFuncDesc} desc={blankPropDesc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => editor && div.querySelector('input.ant-input'));

    simulateInput(editor, {key: 'A'}, 'A');
    expect(value).toBeNull();

    simulateInput(editor, {key: 'Enter'}, null);
    expect(value).toEqual('A');

    // test escape key
    simulateInput(editor, {key: 'B'}, 'AB');
    expect(value).toEqual('A');

    simulateInput(editor, {key: 'Escape'}, null);
    simulateInput(editor, {key: 'Enter'}, null);
    expect(value).toEqual('1'); // blur back to the value from Props

    // onBlur
    simulateInput(editor, {key: 'C'}, 'ABC');
    expect(value).not.toEqual('ABC');

    editor.onBlur();
    expect(value).toEqual('ABC');
  });
});
