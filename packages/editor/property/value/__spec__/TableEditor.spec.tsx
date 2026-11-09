import React from 'react';
import {flushSync} from 'react-dom';
import {page, userEvent} from 'vitest/browser';
import {DockLayout} from 'rc-dock';
import {blankFuncDesc, Root, type PropDesc, type Flow} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util.ts';
import {defaultWorkerData} from '@ticlo/core/defaults/DefaultFlows.ts';
import {truncateData} from '@ticlo/core/util/DataTruncate.ts';
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
  let layout: DockLayout;
  const dockContext: TicloLayoutContext = {
    ...context,
    editTable: (props) => TableEditor.openFloatPanel(layout, props),
  };
  function Template() {
    [, redraw] = React.useReducer((n) => n + 1, 0);
    return (
      <TicloLayoutContextType.Provider value={dockContext}>
        <div className="ticl-e-property-value" style={{width: 300, position: 'relative'}}>
          <TableEditor value={undefined} name="items" funcDesc={blankFuncDesc} desc={objectDesc} {...current} />
        </div>
        <DockLayout
          ref={(value) => {
            layout = value;
          }}
          defaultLayout={{
            dockbox: {mode: 'horizontal', children: [{tabs: [{id: 'base', title: 'Base', content: <div />}]}]},
          }}
          style={{width: 1000, height: 800}}
        />
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
  document.querySelector<HTMLButtonElement>('.ticl-e-table-editor .ticl-e-box-footer .ant-btn-primary');

function scrollToEnd() {
  const holder = document.querySelector<HTMLElement>('.ant-table-tbody-virtual-holder');
  holder.scrollTop = holder.scrollHeight;
  holder.dispatchEvent(new Event('scroll'));
}

async function open() {
  let trigger: HTMLButtonElement;
  await shouldHappen(
    () =>
      (trigger = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
        /^(Edit|View) table/.test(button.textContent)
      ))
  );
  trigger.click();
  await shouldHappen(() => {
    const pane = document.querySelector('.ticl-e-table-editor');
    return pane?.getAttribute('data-loaded') === 'true';
  }, 2000);
}

async function activateCell(row: number, column = 0) {
  await userEvent.click(rows()[row].querySelectorAll('.ticl-e-table-cell-display')[column]);
}

async function fillCell(row: number, value: string, column = 0) {
  await activateCell(row, column);
  await userEvent.fill(rows()[row].querySelector('textarea'), value);
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

  it('edits a draft in a dock window and preserves hidden object fields', async () => {
    const original = [{label: 'Before', count: 2, enabled: true, extra: {nested: 'keep'}}];
    const onChange = vi.fn();
    mount({value: original, onChange});
    expect(document.querySelector('.ticl-e-table-editor')).toBeNull();
    await open();
    expect(document.querySelector('.dock-fbox .ticl-e-table-editor')).not.toBeNull();
    await fillCell(0, 'After');
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
    WorkerFunctionGen.registerType(defaultWorkerData, {id: ':render', name: 'render'}, undefined, flow.getFuncModule());
    const [, conn] = makeLocalConnection(Root.instance, true);
    const onChange = vi.fn();
    mount({
      conn,
      funcModule: 'TableEditorTest',
      value: [{renderer: undefined}],
      onChange,
      desc: {...objectDesc, columns: [{key: 'renderer', type: 'worker'}]},
    });
    await open();
    await activateCell(0);
    await userEvent.click(rows()[0].querySelector('.anticon-down'));
    await shouldHappen(() => document.querySelector('.ticl-e-func-select'));
    await userEvent.click(document.querySelector('.ticl-e-func-select .anticon-book'));
    await page.getByText('render', {exact: true}).click();
    expect(rows()[0].querySelector('.ticl-e-worker-editor').textContent).toContain(':render');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(document.querySelector('.ticl-e-table-editor .ticl-e-box-footer button:last-child'));
    await shouldHappen(() => !document.querySelector('.ticl-e-table-editor'));
    expect(onChange).not.toHaveBeenCalled();
    await open();
    expect(rows()[0].querySelector('.ticl-e-table-cell-display').textContent).toBe('');
    await activateCell(0);
    await userEvent.click(rows()[0].querySelector('.anticon-down'));
    await page.getByRole('button', {name: /Inline/}).click();
    await button('OK').click();
    expect(onChange).toHaveBeenCalledExactlyOnceWith([{renderer: defaultWorkerData}], 'items');
  });

  it('edits inline workers in a child dialog without writing through the table draft', async () => {
    const renderer = {...defaultWorkerData, child: {'#is': ':render'}};
    const original = [{renderer}];
    const flow = Root.instance.addFlow('TableEditorTest', {
      data: {'#is': '', 'items': original},
    });
    WorkerFunctionGen.registerType(defaultWorkerData, {id: ':render', name: 'render'}, undefined, flow.getFuncModule());
    const [, conn] = makeLocalConnection(Root.instance, true);
    const onChange = vi.fn();
    const editWorker = vi.spyOn(conn, 'editWorker');
    mount({
      conn,
      keys: ['TableEditorTest.data'],
      funcModule: 'TableEditorTest',
      value: original,
      onChange,
      desc: {...objectDesc, columns: [{key: 'renderer', type: 'worker'}]},
    });
    await open();
    await activateCell(0);
    await userEvent.click(rows()[0].querySelector('.anticon-edit'));
    await shouldHappen(() => document.querySelector('.ticl-e-table-worker-editor .ticl-e-stage'));
    const path = editWorker.mock.calls[0][0];
    const draft = Root.instance.queryValue(path) as Flow;
    expect(draft.getFuncModule()).toBe(flow.getFuncModule());
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
    await shouldHappen(() => (flow.queryValue('data.items') as any)[0].renderer.child.test === 'draft');
    expect(onChange).not.toHaveBeenCalled();
    const tempPath = path.slice(0, path.lastIndexOf('.'));
    await shouldHappen(() => Root.instance.queryValue(tempPath) === undefined);
    expect(flow.queryValue('data.items')).toEqual([
      {renderer: {...renderer, child: {'#is': ':render', 'test': 'draft'}}},
    ]);
    editWorker.mockRestore();
  });

  it('cancels cell and row changes without mutating the input', async () => {
    const original = [{label: 'Keep', count: 0, enabled: false}];
    const onChange = vi.fn();
    mount({value: original, onChange});
    await open();
    await activateCell(0, 2);
    await userEvent.click(rows()[0].querySelector('.ant-switch'));
    await button('Add row').click();
    await userEvent.click(document.querySelector('.dock-fbox .dock-tab-close-btn'));
    await shouldHappen(() => !document.querySelector('.ticl-e-table-editor'));
    expect(onChange).not.toHaveBeenCalled();
    expect(original).toEqual([{label: 'Keep', count: 0, enabled: false}]);
    await open();
    expect(rows()).toHaveLength(1);
    expect(rows()[0].querySelectorAll('.ticl-e-table-cell-display')[2].textContent).toBe('false');
  });

  it('edits a named worker in its original local function module', async () => {
    const flow = Root.instance.addFlow('TableEditorTest');
    WorkerFunctionGen.registerType(defaultWorkerData, {id: ':render', name: 'render'}, undefined, flow.getFuncModule());
    const [, conn] = makeLocalConnection(Root.instance, true);
    const editWorker = vi.spyOn(conn, 'editWorker');
    const onChange = vi.fn();
    mount({
      conn,
      funcModule: 'TableEditorTest',
      value: [{renderer: ':render'}],
      onChange,
      desc: {...objectDesc, columns: [{key: 'renderer', type: 'worker'}]},
    });
    await open();
    await activateCell(0);
    await userEvent.click(rows()[0].querySelector('.anticon-edit'));
    await shouldHappen(() => document.querySelector('.ticl-e-table-worker-editor .ticl-e-stage'));
    const path = editWorker.mock.calls[0][0];
    expect(editWorker).toHaveBeenCalledWith(path, undefined, ':render', undefined, 'TableEditorTest');
    await conn.addBlock(`${path}.child`, {'#is': '', 'value': 'saved'});
    await userEvent.click(document.querySelector('.ticl-e-table-worker-editor .ant-modal-footer .ant-btn-primary'));
    await shouldHappen(() => !document.querySelector('.ticl-e-table-worker-editor'));
    expect(flow.getFuncModule().getWorkerData(':render')).toEqual({
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
    await fillCell(0, 'edited');
    await userEvent.click(rows()[0].querySelector('[title="Move down"]'));
    expect(rows().map((row) => row.querySelector('.ticl-e-table-cell-display').textContent)).toEqual(['two', 'edited']);
    await userEvent.click(rows()[1].querySelector('[title="Duplicate row"]'));
    await fillCell(2, 'copy');
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

  it('honors property locks and read-only columns', async () => {
    const onChange = vi.fn();
    const update = mount({value: [{label: 'Readonly', count: 2}], locked: true, onChange});
    await shouldHappen(() => document.querySelector('button'));
    expect(document.querySelector('button').disabled).toBe(false);
    update({locked: false, desc: {...objectDesc, readonly: true}});
    await open();
    expect(rows()[0].querySelector('.ticl-e-table-cell-display').textContent).toBe('Readonly');
    await activateCell(0);
    expect(rows()[0].querySelector('textarea')).toBeNull();
    await button('Close').click();
    update({
      desc: {
        ...objectDesc,
        columns: objectDesc.columns.map((column) => ({...column, readonly: column.key === 'label'})),
      },
    });
    await open();
    await activateCell(0);
    expect(rows()[0].querySelector('textarea')).toBeNull();
    await button('Cancel').click();
    update({onChange: undefined});
    await open();
    expect(confirm()).toBeNull();
    await button('Close').click();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('blocks saving if write permission changes while the dock window is open', async () => {
    const flow = Root.instance.addFlow('TableEditorTest', {data: {'#is': '', 'items': [{label: 'Keep'}]}});
    const [server, conn] = makeLocalConnection(Root.instance, true);
    mount({conn, keys: ['TableEditorTest.data'], value: [{label: 'Keep'}], onChange: vi.fn()});
    await open();
    await fillCell(0, 'Draft');
    server.setEditPolicy({readonly: true});
    await shouldHappen(() => !confirm());
    expect(rows()[0].querySelector('textarea')).toBeNull();
    expect(flow.queryValue('data.items')).toEqual([{label: 'Keep'}]);
    server.setEditPolicy(undefined);
    await shouldHappen(() => Boolean(confirm()));
    await button('Cancel').click();
  });

  it('blocks a stale draft and lets the user reload an external update', async () => {
    const flow = Root.instance.addFlow('TableEditorTest', {data: {'#is': '', 'items': [{label: 'Old'}]}});
    const [, conn] = makeLocalConnection(Root.instance, true);
    const onChange = vi.fn();
    mount({conn, keys: ['TableEditorTest.data'], value: [{label: 'Old'}], onChange});
    await open();
    await fillCell(0, 'Draft');
    await conn.setValue('TableEditorTest.data.items', [{label: 'New'}], true);
    await button('OK').click();
    expect(confirm().disabled).toBe(true);
    expect(document.querySelector('.ticl-e-error-message').textContent).toContain('Value changed');
    await button('Reload').click();
    expect(rows()[0].querySelector('.ticl-e-table-cell-display').textContent).toBe('New');
    await button('OK').click();
    await shouldHappen(() => !document.querySelector('.ticl-e-table-editor'));
    expect(flow.queryValue('data.items')).toEqual([{label: 'New'}]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('saves to the original property after the selection changes', async () => {
    const flow = Root.instance.addFlow('TableEditorTest', {
      first: {'#is': '', 'items': [{label: 'First'}]},
      second: {'#is': '', 'items': [{label: 'Second'}]},
    });
    const [, conn] = makeLocalConnection(Root.instance, true);
    const update = mount({conn, keys: ['TableEditorTest.first'], value: [{label: 'First'}], onChange: vi.fn()});
    await open();
    await fillCell(0, 'Edited');
    update({keys: ['TableEditorTest.second'], value: [{label: 'Second'}]});
    await button('OK').click();
    await shouldHappen(() => (flow.queryValue('first.items') as any)[0].label === 'Edited');
    expect(flow.queryValue('second.items')).toEqual([{label: 'Second'}]);
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

  it('discovers the first and last object rows, then scans all rows on request', async () => {
    const value = [{first: 'a'}, {middle: 2}, {last: true}];
    const onChange = vi.fn();
    mount({value, onChange, desc: {name: 'items', type: 'table'}});
    await open();
    expect(rows()[0].querySelectorAll('.ticl-e-table-cell-display')).toHaveLength(2);
    await button('Add column').click();
    await button('Find all columns').click();
    expect(rows()[1].querySelectorAll('.ticl-e-table-cell-display')).toHaveLength(3);
    expect(rows()[1].textContent).toContain('2');
    await activateCell(1, 2);
    expect(rows()[1].querySelector('.ant-input-number')).not.toBeNull();
    await button('Cancel').click();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('can reveal hidden columns while viewing a read-only table', async () => {
    mount({value: [{first: 1}, {middle: 2}, {last: 3}], desc: {name: 'items', type: 'table'}});
    await open();
    expect(rows()[1].querySelectorAll('.ticl-e-table-cell-display')).toHaveLength(2);
    await button('Columns').click();
    await button('Find all columns').click();
    expect(rows()[1].querySelectorAll('.ticl-e-table-cell-display')).toHaveLength(3);
    await activateCell(1, 2);
    expect(rows()[1].querySelector('.ant-input-number')).toBeNull();
  });

  it('adds and deletes columns in a schema table without mutating the source', async () => {
    const value = {
      columns: [
        {name: 'label', type: 'string'},
        {name: 'count', type: 'number'},
      ],
      rows: [
        ['one', 1],
        ['two', 2],
      ],
      note: 'keep',
    };
    const onChange = vi.fn();
    mount({value, onChange, desc: {name: 'items', type: 'table'}});
    await open();
    await fillCell(0, 'edited');
    await button('Add column').click();
    await userEvent.fill(document.querySelector('.ticl-e-table-add-column input'), 'enabled');
    await userEvent.click(document.querySelector('.ticl-e-table-add-column button'));
    await fillCell(0, 'yes', 2);
    await userEvent.click(document.querySelectorAll('.ticl-e-table-column-title [title="Delete column"]')[1]);
    await button('OK').click();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(
      {
        columns: [
          {name: 'label', type: 'string'},
          {name: 'enabled', type: 'string'},
        ],
        rows: [
          ['edited', 'yes'],
          ['two', ''],
        ],
        note: 'keep',
      },
      'items'
    );
    expect(value.rows).toEqual([
      ['one', 1],
      ['two', 2],
    ]);
  });

  it('keeps columns on an empty object array only in the dialog draft', async () => {
    const onChange = vi.fn();
    mount({value: [], onChange, desc: {name: 'items', type: 'table'}});
    await open();
    await button('Add column').click();
    await userEvent.fill(document.querySelector('.ticl-e-table-add-column input'), 'temporary');
    await userEvent.click(document.querySelector('.ticl-e-table-add-column button'));
    expect(document.querySelector('.ticl-e-table-editor .ant-table-thead').textContent).toContain('temporary');
    await button('OK').click();
    expect(onChange).toHaveBeenCalledExactlyOnceWith([], 'items');
    await open();
    expect(document.querySelector('.ticl-e-table-editor .ant-table-thead').textContent).not.toContain('temporary');
  });

  it('loads complete connected data and saves through PropertyEditor', async () => {
    const items = Array.from({length: 15}, (_, count) => ({label: `Row ${count}`, count, hidden: 'x'.repeat(300)}));
    const flow = Root.instance.addFlow('TableEditorTest', {data: {'#is': '', items}});
    const [, conn] = makeLocalConnection(Root.instance, true);
    const getPage = vi.spyOn(conn, 'getValuePage');
    let layout: DockLayout;
    loadTemplate(
      <TicloLayoutContextType.Provider value={{editTable: (props) => TableEditor.openFloatPanel(layout, props)}}>
        <PropertyEditor
          conn={conn}
          paths={['TableEditorTest.data']}
          name="items"
          funcDesc={blankFuncDesc}
          propDesc={objectDesc}
        />
        <DockLayout
          ref={(value) => {
            layout = value;
          }}
          defaultLayout={{
            dockbox: {mode: 'horizontal', children: [{tabs: [{id: 'base', title: 'Base', content: <div />}]}]},
          }}
          style={{width: 1000, height: 800}}
        />
      </TicloLayoutContextType.Provider>,
      'editor'
    );
    await open();
    expect(getPage).not.toHaveBeenCalled();
    await fillCell(0, 'Updated');
    await button('OK').click();
    await shouldHappen(() => (flow.queryValue('data.items') as typeof items)[0].label === 'Updated');
    expect(flow.queryValue('data.items')).toEqual([{...items[0], label: 'Updated'}, ...items.slice(1)]);
  });

  it('appends pages on scroll and only enables editing after every row is loaded', async () => {
    const items = Array.from({length: 1015}, (_, id) => ({label: `Row ${id}`}));
    Object.assign(items.at(-1), {tail: 'Last column'});
    const flow = Root.instance.addFlow('TableEditorTest', {data: {'#is': '', items}});
    const [, conn] = makeLocalConnection(Root.instance, true);
    const getPage = vi.spyOn(conn, 'getValuePage');
    const getValue = vi.spyOn(conn, 'getValue');
    mount({
      conn,
      keys: ['TableEditorTest.data'],
      value: truncateData(items)[0],
      onChange: vi.fn(),
      desc: {name: 'items', type: 'table'},
    });
    await open();
    expect(getPage).toHaveBeenCalledExactlyOnceWith('TableEditorTest.data.items', {
      select: undefined,
      offset: 0,
      limit: 1000,
    });
    expect(getValue).not.toHaveBeenCalled();
    expect(document.querySelector('.ant-table-thead').textContent).toContain('tail');
    expect(confirm().disabled).toBe(true);
    await activateCell(0);
    expect(rows()[0].querySelector('textarea')).toBeNull();

    const settings = document.querySelector<HTMLElement>('button[title="Rows per request"]');
    await userEvent.click(settings);
    let input: HTMLInputElement;
    await shouldHappen(() => (input = document.querySelector('.ticl-e-table-add-column .ant-input-number-input')));
    await userEvent.fill(input, '5');
    await userEvent.tab();
    expect(input.value).toBe('10');
    await userEvent.click(settings);
    scrollToEnd();
    await shouldHappen(
      () =>
        getPage.mock.calls.length === 2 &&
        document.querySelector('.ticl-e-table-toolbar').textContent.includes('1010 / 1015')
    );
    expect(getPage.mock.calls[1][1]).toEqual({
      select: undefined,
      offset: 1000,
      limit: 10,
      anchor: {label: 'Row 999'},
    });
    expect(confirm().disabled).toBe(true);
    scrollToEnd();
    await shouldHappen(() => !confirm().disabled);
    expect(getPage.mock.calls.map(([, options]) => options.offset)).toEqual([0, 1000, 1010]);
    expect(getValue).not.toHaveBeenCalled();
    const holder = document.querySelector<HTMLElement>('.ant-table-tbody-virtual-holder');
    holder.scrollTop = 0;
    holder.dispatchEvent(new Event('scroll'));
    await shouldHappen(() => rows()[0]?.textContent.includes('Row 0'));
    await fillCell(0, 'Edited');
    await button('OK').click();
    await shouldHappen(() => (flow.queryValue('data.items') as any[])[0].label === 'Edited');
    expect(flow.queryValue('data.items')).toEqual([{label: 'Edited'}, ...items.slice(1)]);
  });

  it('detects an in-place boundary mutation on a connection that passes references', async () => {
    const items = Array.from({length: 1005}, (_, id) => ({label: `Row ${id}`}));
    const flow = Root.instance.addFlow('TableEditorTest', {data: {'#is': '', items}});
    const [, conn] = makeLocalConnection(Root.instance, true, undefined, false);
    const getPage = vi.spyOn(conn, 'getValuePage');
    mount({conn, keys: ['TableEditorTest.data'], value: items, onChange: vi.fn()});
    await open();
    (flow.queryValue('data.items') as typeof items)[999].label = 'Changed boundary';
    scrollToEnd();
    await shouldHappen(() => document.querySelector('.ticl-e-error-message')?.textContent.includes('Value changed'));
    expect(confirm().disabled).toBe(true);
    expect(getPage).toHaveBeenCalledTimes(2);
    scrollToEnd();
    await waitTick(20);
    expect(getPage).toHaveBeenCalledTimes(2);
  });

  it('fills a viewport before waiting for further scrolls', async () => {
    mount({value: Array.from({length: 1005}, (_, id) => ({label: `Row ${id}`}))});
    await open();
    const settings = document.querySelector<HTMLElement>('button[title="Rows per request"]');
    await userEvent.click(settings);
    let input: HTMLInputElement;
    await shouldHappen(() => (input = document.querySelector('.ticl-e-table-add-column .ant-input-number-input')));
    await userEvent.fill(input, '10');
    await userEvent.tab();
    await userEvent.click(settings);
    await button('Reload').click();
    await shouldHappen(() => document.querySelector('.ticl-e-table-toolbar').textContent.includes('20 / 1005'));
    scrollToEnd();
    await shouldHappen(() => document.querySelector('.ticl-e-table-toolbar').textContent.includes('30 / 1005'));
  });

  it('discards a pending continuation when the table is reloaded', async () => {
    const items = Array.from({length: 1005}, (_, id) => ({label: `Row ${id}`}));
    const flow = Root.instance.addFlow('TableEditorTest', {data: {'#is': '', items}});
    const [, conn] = makeLocalConnection(Root.instance, true);
    const getPage = vi.spyOn(conn, 'getValuePage');
    mount({conn, keys: ['TableEditorTest.data'], value: truncateData(items)[0], onChange: vi.fn()});
    await open();
    let finish: (page: any) => void;
    getPage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    scrollToEnd();
    await shouldHappen(() => Boolean(finish));
    flow.queryProperty('data.items').setValue([{label: 'Replacement'}]);
    await button('Reload').click();
    await shouldHappen(() => !confirm().disabled);
    finish({items: items.slice(1000), offset: 1000, total: 1005});
    await waitTick(20);
    await fillCell(0, 'Saved');
    await button('OK').click();
    await shouldHappen(() => (flow.queryValue('data.items') as any[])[0].label === 'Saved');
    expect(flow.queryValue('data.items')).toEqual([{label: 'Saved'}]);
  });

  it('pages matrix rows separately and preserves current metadata on save', async () => {
    const value = {
      columns: [{name: 'label', type: 'string'}],
      rows: Array.from({length: 1005}, (_, id) => [`Row ${id}`]),
      note: 'Original',
    };
    const flow = Root.instance.addFlow('TableEditorTest', {data: {'#is': '', 'items': value}});
    const [, conn] = makeLocalConnection(Root.instance, true);
    const getPage = vi.spyOn(conn, 'getValuePage');
    const getValue = vi.spyOn(conn, 'getValue');
    mount({conn, keys: ['TableEditorTest.data'], value, onChange: vi.fn(), desc: {name: 'items', type: 'table'}});
    await open();
    expect(getPage.mock.calls[0][1].select).toEqual(['rows']);
    expect(getValue).toHaveBeenCalledExactlyOnceWith('TableEditorTest.data.items', {select: ['columns']});
    expect(confirm().disabled).toBe(true);
    scrollToEnd();
    await shouldHappen(() => !confirm().disabled);
    (flow.queryValue('data.items') as typeof value).note = 'Updated metadata';
    const holder = document.querySelector<HTMLElement>('.ant-table-tbody-virtual-holder');
    holder.scrollTop = 0;
    holder.dispatchEvent(new Event('scroll'));
    await shouldHappen(() => rows()[0]?.textContent.includes('Row 0'));
    await fillCell(0, 'Saved');
    await button('OK').click();
    await shouldHappen(() => (flow.queryValue('data.items') as typeof value).rows[0][0] === 'Saved');
    expect(flow.queryValue('data.items')).toEqual({
      ...value,
      note: 'Updated metadata',
      rows: [['Saved'], ...value.rows.slice(1)],
    });
  });
});
