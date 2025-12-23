import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from '../../../util/test-util.js';
import {initEditor} from '../../../index.js';
import {PasswordEditor} from '../PasswordEditor.js';
import {shouldHappen} from '@ticlo/core/util/test-util.js';
import {blankFuncDesc, blankPropDesc} from '@ticlo/core';
import {simulateInput} from './simulate-input.js';
import {DateEditor} from '../DateEditor.js';

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
    expect(value).toBe('A');

    // test escape key
    simulateInput(editor, {key: 'B'}, 'AB');
    expect(value).toBe('A');

    simulateInput(editor, {key: 'Escape'}, null);
    simulateInput(editor, {key: 'Enter'}, null);
    expect(value).toBe('1'); // blur back to the value from Props

    // onBlur
    simulateInput(editor, {key: 'C'}, 'ABC');
    expect(value).not.toBe('ABC');

    editor.onBlur();
    expect(value).toBe('ABC');
  });
});
