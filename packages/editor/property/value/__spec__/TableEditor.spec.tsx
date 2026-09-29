import React from 'react';
import {flushSync} from 'react-dom';
import {page, userEvent} from 'vitest/browser';
import {blankFuncDesc, Root, type PropDesc} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '../../../index.ts';
import {loadTemplate, removeLastTemplate} from '../../../util/test-util.ts';
import {PropertyEditor} from '../../PropertyEditor.tsx';
import {TableEditor} from '../TableEditor.tsx';
import type {ValueEditorProps} from '../ValueEditorBase.ts';

const objectDesc: PropDesc = {
  name: 'items',
  type: 'table',
  rowType: 'object',
  columns: [
    {key: 'label', title: 'Label', type: 'string'},
    {key: 'count', title: 'Count', type: 'number', init: 0},
    {key: 'enabled', title: 'Enabled', type: 'toggle', init: false},
  ],
};

function mount(props: Partial<ValueEditorProps>) {
  let current = props;
  let redraw: () => void;
  function Template() {
    [, redraw] = React.useReducer((n) => n + 1, 0);
    return <TableEditor value={undefined} name="items" funcDesc={blankFuncDesc} desc={objectDesc} {...current} />;
  }
  loadTemplate(<Template />, 'editor');
  return (props: Partial<ValueEditorProps>) =>
    flushSync(() => {
      current = {...current, ...props};
      redraw();
    });
}

const button = (name: string) => page.getByRole('button', {name, exact: true});
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.ticl-table-editor .ant-table-row'));
const confirm = () =>
  document.querySelector<HTMLButtonElement>('.ticl-table-editor .ant-modal-footer .ant-btn-primary');

async function open() {
  await page.getByRole('button', {name: /Edit table/}).click({timeout: 3000});
  await shouldHappen(
    () => document.querySelector('.ticl-table-editor') && !document.querySelector('.ant-spin-spinning'),
    2000
  );
}

describe('TableEditor', () => {
  beforeEach(async () => {
    await initEditor();
  });

  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue('TableEditorTest');
  });

  it('edits a draft in a dialog and preserves hidden object fields', async () => {
    const original = [{label: 'Before', count: 2, enabled: true, extra: {nested: 'keep'}}];
    const onChange = vi.fn();
    mount({value: original, onChange});
    expect(document.querySelector('.ticl-table-editor')).toBeNull();
    await open();
    await userEvent.fill(rows()[0].querySelector('textarea'), 'After');
    // Clicking OK must commit the last focused cell's pending value too.
    await button('OK').click();
    expect(onChange).toHaveBeenCalledExactlyOnceWith([{...original[0], label: 'After'}], 'items');
    expect(original[0].label).toBe('Before');
    expect(document.querySelector('.ticl-table-editor')).toBeNull();
  });

  it('cancels cell and row changes without mutating the input', async () => {
    const original = [{label: 'Keep', count: 0, enabled: false}];
    const onChange = vi.fn();
    mount({value: original, onChange});
    await open();
    await userEvent.click(rows()[0].querySelector('.ant-switch'));
    await button('Add row').click();
    await button('Cancel').click();
    expect(onChange).not.toHaveBeenCalled();
    expect(original).toEqual([{label: 'Keep', count: 0, enabled: false}]);
    await open();
    expect(rows()).toHaveLength(1);
    expect(rows()[0].querySelector('.ant-switch').getAttribute('aria-checked')).toBe('false');
  });

  it('supports array rows, initial values, duplication, reordering and removal', async () => {
    const original = [
      ['one', 1, 'extra'],
      ['two', 2, 'other'],
    ];
    const onChange = vi.fn();
    mount({
      value: original,
      onChange,
      desc: {
        name: 'items',
        type: 'table',
        rowType: 'array',
        columns: [
          {key: 0, type: 'string', init: 'new'},
          {key: 1, type: 'number', init: 0, default: 99},
        ],
      },
    });
    await open();
    await userEvent.fill(rows()[0].querySelector('textarea'), 'edited');
    await userEvent.click(rows()[0].querySelector('[aria-label="Move down"]'));
    expect(rows().map((row) => row.querySelector('textarea').value)).toEqual(['two', 'edited']);
    await userEvent.click(rows()[1].querySelector('[aria-label="Duplicate row"]'));
    await userEvent.fill(rows()[2].querySelector('textarea'), 'copy');
    await userEvent.click(rows()[0].querySelector('[aria-label="Delete row"]'));
    await button('Add row').click();
    await button('OK').click();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(
      [
        ['edited', 1, 'extra'],
        ['copy', 1, 'extra'],
        ['new', 0],
      ],
      'items'
    );
    expect(original).toEqual([
      ['one', 1, 'extra'],
      ['two', 2, 'other'],
    ]);
  });

  it('can initialize an empty array and keeps missing, null, false and zero distinct', async () => {
    const onChange = vi.fn();
    mount({
      onChange,
      desc: {
        ...objectDesc,
        columns: [
          ...objectDesc.columns,
          {key: 'optional', type: 'string', default: 'display only'},
          {key: 'nullable', type: 'number', init: null},
        ],
      },
    });
    await open();
    await button('Add row').click();
    await button('OK').click();
    expect(onChange).toHaveBeenCalledExactlyOnceWith([{count: 0, enabled: false, nullable: null}], 'items');
  });

  it('honors property locks, read-only columns and permission changes while open', async () => {
    const onChange = vi.fn();
    const update = mount({value: [{label: 'Readonly', count: 2}], locked: true, onChange});
    await shouldHappen(() => document.querySelector('button'));
    expect(document.querySelector('button').disabled).toBe(true);
    update({locked: false, desc: {...objectDesc, readonly: true}});
    expect(document.querySelector('button').disabled).toBe(true);
    update({
      desc: {
        ...objectDesc,
        columns: objectDesc.columns.map((column) => ({...column, readonly: column.key === 'label'})),
      },
    });
    await open();
    expect(rows()[0].querySelector('textarea').disabled).toBe(true);
    update({onChange: undefined});
    expect(confirm().disabled).toBe(true);
    await button('Cancel').click();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('blocks a stale draft and lets the user reload an external update', async () => {
    const onChange = vi.fn();
    const update = mount({value: [{label: 'Old'}], onChange});
    await open();
    await userEvent.fill(rows()[0].querySelector('textarea'), 'Draft');
    update({value: [{label: 'New'}]});
    expect(confirm().disabled).toBe(true);
    expect(document.querySelector('[role="alert"]').textContent).toContain('Value changed');
    await button('Reload').click();
    expect(rows()[0].querySelector('textarea').value).toBe('New');
    await button('OK').click();
    expect(onChange).toHaveBeenCalledExactlyOnceWith([{label: 'New'}], 'items');
  });

  it('rejects mismatched rows and invalid column keys without overwriting data', async () => {
    const onChange = vi.fn();
    const update = mount({value: [[1, 2]], onChange});
    await open();
    expect(document.querySelector('[role="alert"]').textContent).toContain('Invalid table rows');
    expect(confirm().disabled).toBe(true);
    await button('Cancel').click();
    update({desc: {...objectDesc, rowType: 'array'}});
    await open();
    expect(document.querySelector('[role="alert"]').textContent).toContain('Invalid table columns');
    expect(confirm().disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('loads complete connected data and saves through PropertyEditor', async () => {
    const items = Array.from({length: 15}, (_, count) => ({label: `Row ${count}`, count, hidden: 'x'.repeat(300)}));
    const flow = Root.instance.addFlow('TableEditorTest', {data: {'#is': '', items}});
    const [, conn] = makeLocalConnection(Root.instance, true);
    loadTemplate(
      <PropertyEditor
        conn={conn}
        paths={['TableEditorTest.data']}
        name="items"
        funcDesc={blankFuncDesc}
        propDesc={objectDesc}
      />,
      'editor'
    );
    await open();
    expect(rows()).toHaveLength(15);
    await userEvent.fill(rows()[0].querySelector('textarea'), 'Updated');
    await button('OK').click();
    await shouldHappen(() => (flow.queryValue('data.items') as typeof items)[0].label === 'Updated');
    expect(flow.queryValue('data.items')).toEqual([{...items[0], label: 'Updated'}, ...items.slice(1)]);
  });
});
