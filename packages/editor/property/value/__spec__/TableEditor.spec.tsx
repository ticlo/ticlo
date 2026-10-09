import React from 'react';
import {flushSync} from 'react-dom';
import {page, userEvent} from 'vitest/browser';
import {blankFuncDesc, Root, type PropDesc, type Flow} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util.ts';
import {defaultWorkerData} from '@ticlo/core/defaults/DefaultFlows.ts';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.ts';
import {initEditor} from '../../../index.ts';
import {loadTemplate, removeLastTemplate} from '../../../util/test-util.ts';
import {PropertyEditor} from '../../PropertyEditor.tsx';
import {TableEditor} from '../TableEditor.tsx';
import type {ValueEditorProps} from '../ValueEditorBase.ts';
import {TicloLayoutContextType, type TicloLayoutContext} from '../../../component/LayoutContext.ts';

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

function mount(props: Partial<ValueEditorProps>, context: TicloLayoutContext = {}) {
  let current = props;
  let redraw: () => void;
  function Template() {
    [, redraw] = React.useReducer((n) => n + 1, 0);
    return (
      <TicloLayoutContextType.Provider value={context}>
        <div className="ticl-e-property-value" style={{width: 300, position: 'relative'}}>
          <TableEditor value={undefined} name="items" funcDesc={blankFuncDesc} desc={objectDesc} {...current} />
        </div>
      </TicloLayoutContextType.Provider>
    );
  }
  loadTemplate(<Template />, 'editor');
  return (props: Partial<ValueEditorProps>) =>
    flushSync(() => {
      current = {...current, ...props};
      redraw();
    });
}

const button = (name: string) => page.getByRole('button', {name, exact: true});
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.ticl-e-table-editor .ant-table-row'));
const confirm = () =>
  document.querySelector<HTMLButtonElement>('.ticl-e-table-editor .ant-modal-footer .ant-btn-primary');

async function open() {
  await page.getByRole('button', {name: /Edit table/}).click({timeout: 3000});
  await shouldHappen(
    () => document.querySelector('.ticl-e-table-editor') && !document.querySelector('.ant-spin-spinning'),
    2000
  );
}

describe('TableEditor', () => {
  beforeEach(async () => {
    await initEditor();
  });

  afterEach(async () => {
    removeLastTemplate();
    await waitTick(30);
    destroyLastLocalConnection();
    Root.instance.deleteValue('TableEditorTest');
  });

  it('edits a draft in a dialog and preserves hidden object fields', async () => {
    const original = [{label: 'Before', count: 2, enabled: true, extra: {nested: 'keep'}}];
    const onChange = vi.fn();
    mount({value: original, onChange});
    expect(document.querySelector('.ticl-e-table-editor')).toBeNull();
    await open();
    await userEvent.fill(rows()[0].querySelector('textarea'), 'After');
    // Clicking OK must commit the last focused cell's pending value too.
    await button('OK').click();
    expect(onChange).toHaveBeenCalledExactlyOnceWith([{...original[0], label: 'After'}], 'items');
    expect(original[0].label).toBe('Before');
    expect(document.querySelector('.ticl-e-table-editor')).toBeNull();
  });

  it('expands raw JSON/YAML using the property paths and read-only state', async () => {
    const value = [{label: 'Raw'}];
    const editProperty = vi.fn();
    const update = mount({keys: ['first', 'second'], value, onChange: vi.fn()}, {editProperty});
    await shouldHappen(() => document.querySelector('.ticl-e-expand-button'));
    await userEvent.click(document.querySelector('.ticl-e-expand-button'));
    expect(editProperty).toHaveBeenLastCalledWith(['first.items', 'second.items'], objectDesc, value, 'object', false);
    expect(document.querySelector('.ticl-e-table-editor')).toBeNull();
    update({locked: true});
    await userEvent.click(document.querySelector('.ticl-e-expand-button'));
    expect(editProperty).toHaveBeenLastCalledWith(['first.items', 'second.items'], objectDesc, value, 'object', true);
  });

  it('selects local workers in the table draft and discards them on cancel', async () => {
    const flow = Root.instance.addFlow('TableEditorTest');
    WorkerFunctionGen.registerType(defaultWorkerData, {id: ':render', name: 'render'}, undefined, flow.getFuncLib());
    const [, conn] = makeLocalConnection(Root.instance, true);
    const onChange = vi.fn();
    mount({
      conn,
      funcLib: 'TableEditorTest',
      value: [{renderer: undefined}],
      onChange,
      desc: {...objectDesc, columns: [{key: 'renderer', type: 'worker'}]},
    });
    await open();
    await userEvent.click(rows()[0].querySelector('.anticon-down'));
    await shouldHappen(() => document.querySelector('.ticl-e-func-select'));
    await userEvent.click(document.querySelector('.ticl-e-func-select .anticon-book'));
    await page.getByText('render', {exact: true}).click({timeout: 3000});
    expect(rows()[0].querySelector('.ticl-e-worker-editor').textContent).toContain(':render');
    expect(onChange).not.toHaveBeenCalled();
    await button('Cancel').click();
    expect(onChange).not.toHaveBeenCalled();
    await open();
    expect(rows()[0].querySelector('.ticl-e-object-editor').textContent).toBe('');
    await userEvent.click(rows()[0].querySelector('.anticon-down'));
    await page.getByRole('button', {name: /Inline/}).click({timeout: 3000});
    await button('OK').click();
    expect(onChange).toHaveBeenCalledExactlyOnceWith([{renderer: defaultWorkerData}], 'items');
  });

  it('edits inline workers in a child dialog without writing through the table draft', async () => {
    const renderer = {...defaultWorkerData, child: {'#is': ':render'}};
    const original = [{renderer}];
    const flow = Root.instance.addFlow('TableEditorTest', {
      data: {'#is': '', 'items': original},
    });
    WorkerFunctionGen.registerType(defaultWorkerData, {id: ':render', name: 'render'}, undefined, flow.getFuncLib());
    const [, conn] = makeLocalConnection(Root.instance, true);
    const onChange = vi.fn();
    const editWorker = vi.spyOn(conn, 'editWorker');
    mount({
      conn,
      keys: ['TableEditorTest.data'],
      funcLib: 'TableEditorTest',
      value: original,
      onChange,
      desc: {...objectDesc, columns: [{key: 'renderer', type: 'worker'}]},
    });
    await open();
    await userEvent.click(rows()[0].querySelector('.anticon-edit'));
    await shouldHappen(() => document.querySelector('.ticl-e-table-worker-editor .ticl-e-stage'));
    const path = editWorker.mock.calls[0][0];
    const draft = Root.instance.queryValue(path) as Flow;
    expect(draft.getFuncLib()).toBe(flow.getFuncLib());
    await conn.setValue(`${path}.child.test`, 'draft', true);
    const workerDialog = document.querySelector('.ticl-e-table-worker-editor');
    await userEvent.click(workerDialog.querySelector('.ant-modal-footer .ant-btn-primary'));
    await shouldHappen(() => !document.querySelector('.ticl-e-table-worker-editor'));
    expect(flow.queryValue('data.items')).toEqual(original);
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(rows()[0].querySelector('.anticon-edit'));
    await shouldHappen(() => document.querySelector('.ticl-e-table-worker-editor .ticl-e-stage'));
    expect(Root.instance.queryValue(`${path}.child.test`)).toBe('draft');
    await conn.setValue(`${path}.child.test`, 'discard', true);
    await userEvent.click(document.querySelector('.ticl-e-table-worker-editor .ant-modal-footer .ant-btn-default'));
    await shouldHappen(() => !document.querySelector('.ticl-e-table-worker-editor'));
    await button('OK').click();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(
      [{renderer: {...renderer, child: {'#is': ':render', 'test': 'draft'}}}],
      'items'
    );
    const tempPath = path.slice(0, path.lastIndexOf('.'));
    await shouldHappen(() => Root.instance.queryValue(tempPath) === undefined);
    expect(flow.queryValue('data.items')).toEqual(original);
    editWorker.mockRestore();
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
    expect(rows()[0].querySelector('.ant-switch').classList.contains('ant-switch-checked')).toBe(false);
  });

  it('edits a named worker in its original local function library', async () => {
    const flow = Root.instance.addFlow('TableEditorTest');
    WorkerFunctionGen.registerType(defaultWorkerData, {id: ':render', name: 'render'}, undefined, flow.getFuncLib());
    const [, conn] = makeLocalConnection(Root.instance, true);
    const editWorker = vi.spyOn(conn, 'editWorker');
    const onChange = vi.fn();
    mount({
      conn,
      funcLib: 'TableEditorTest',
      value: [{renderer: ':render'}],
      onChange,
      desc: {...objectDesc, columns: [{key: 'renderer', type: 'worker'}]},
    });
    await open();
    await userEvent.click(rows()[0].querySelector('.anticon-edit'));
    await shouldHappen(() => document.querySelector('.ticl-e-table-worker-editor .ticl-e-stage'));
    const path = editWorker.mock.calls[0][0];
    expect(editWorker).toHaveBeenCalledWith(path, undefined, ':render', undefined, 'TableEditorTest');
    await conn.addBlock(`${path}.child`, {'#is': '', 'value': 'saved'});
    await userEvent.click(document.querySelector('.ticl-e-table-worker-editor .ant-modal-footer .ant-btn-primary'));
    await shouldHappen(() => !document.querySelector('.ticl-e-table-worker-editor'));
    expect(flow.getFuncLib().getWorkerData(':render')).toEqual({
      ...defaultWorkerData,
      child: {'#is': '', 'value': 'saved'},
    });
    await button('OK').click();
    expect(onChange).toHaveBeenCalledExactlyOnceWith([{renderer: ':render'}], 'items');
    await shouldHappen(() => Root.instance.queryValue(path) === undefined);
    editWorker.mockRestore();
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
    await userEvent.click(rows()[0].querySelector('[title="Move down"]'));
    expect(rows().map((row) => row.querySelector('textarea').value)).toEqual(['two', 'edited']);
    await userEvent.click(rows()[1].querySelector('[title="Duplicate row"]'));
    await userEvent.fill(rows()[2].querySelector('textarea'), 'copy');
    await userEvent.click(rows()[0].querySelector('[title="Delete row"]'));
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
    expect(document.querySelector('.ticl-e-error-message').textContent).toContain('Value changed');
    await button('Reload').click();
    expect(rows()[0].querySelector('textarea').value).toBe('New');
    await button('OK').click();
    expect(onChange).toHaveBeenCalledExactlyOnceWith([{label: 'New'}], 'items');
  });

  it('rejects mismatched rows and invalid column keys without overwriting data', async () => {
    const onChange = vi.fn();
    const update = mount({value: [[1, 2]], onChange});
    await open();
    expect(document.querySelector('.ticl-e-error-message').textContent).toContain('Invalid table rows');
    expect(confirm().disabled).toBe(true);
    await button('Cancel').click();
    update({desc: {...objectDesc, rowType: 'array'}});
    await open();
    expect(document.querySelector('.ticl-e-error-message').textContent).toContain('Invalid table columns');
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
