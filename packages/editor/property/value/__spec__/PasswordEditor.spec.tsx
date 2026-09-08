import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from '../../../util/test-util.ts';
import {initEditor} from '../../../index.ts';
import {PasswordEditor} from '../PasswordEditor.tsx';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {blankFuncDesc, blankPropDesc} from '@ticlo/core';
import {simulateInput} from './simulate-input.ts';
import {DateEditor} from '../DateEditor.tsx';

describe('PasswordEditor', function () {
  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
  });

  it('basic', async function () {
    let editor: PasswordEditor;
    const getRef = (e: PasswordEditor): void => {
      editor = e;
    };
    let value: string = null;
    const onChange = (str: string) => {
      value = str;
    };
    const [component, div] = loadTemplate(
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
