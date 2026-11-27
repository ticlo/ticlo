import React from 'react';
import {flushSync} from 'react-dom';
import {page, userEvent} from 'vitest/browser';
import {DockLayout, type TabData} from 'rc-dock';
import {
  Root,
  globalFunctions,
  escapedObject,
  sqlClientApi,
  sqlClientCommands,
  type Block,
  type SqlResult,
} from '@ticlo/core';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '../../index.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {TicloLayoutContextType} from '../../component/LayoutContext.ts';
import {TextEditorPane} from '../../dock/text-editor/TextEditorPane.tsx';
import {BlockDropdown} from '../BlockDropdown.tsx';
import {SqlClientDialog, openSqlClientDialog} from '../SqlClientDialog.tsx';

const functionId = 'sql-client-dialog-test';
globalFunctions.addFactory(
  null,
  {name: functionId, tags: ['sql-client'], commands: sqlClientCommands, properties: []},
  undefined,
  sqlClientApi
);

const entity = {schema: 'main', name: 'items', kind: 'table' as const};
function service(query = vi.fn().mockResolvedValue({table: {columns: [{name: 'value', type: 'any'}], rows: [[42]]}})) {
  return escapedObject('sql-client-test', {
    listEntities: vi.fn().mockResolvedValue([entity]),
    getColumns: vi.fn().mockResolvedValue([{name: 'value', databaseType: 'INTEGER'}]),
    query,
  });
}
const runButton = () => document.querySelector<HTMLButtonElement>('.ticl-e-sql-main .ant-btn-primary');
const editor = () => document.querySelector<HTMLElement>('.ticl-e-sql-input .cm-content');
const entityTitle = () =>
  Array.from(document.querySelectorAll('.ant-tree-title')).find((node) => node.textContent === entity.name);
const entitySwitcher = () => entityTitle()?.closest('.ant-tree-treenode').querySelector('.ant-tree-switcher');

describe('SQL client management dialog', () => {
  let root: Root;
  beforeEach(async () => {
    await initEditor();
    root = new Root();
  });
  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    root.destroy();
    vi.restoreAllMocks();
  });

  it('opens for any tagged client, loads columns on expansion, and executes without changing the Flow', async () => {
    const database = service();
    const flow = root.addFlow('Test', {database: {'#is': functionId}});
    const block = flow.getValue('database') as Block;
    block.output(database);
    const [, conn] = makeLocalConnection(root, true);
    await shouldHappen(() => conn.watchDesc(functionId)?.tags?.includes('sql-client'));
    const before = flow.save();
    let layout: DockLayout;
    function Template() {
      return (
        <TicloLayoutContextType.Provider
          value={{
            manageDatabase: (conn, path) => openSqlClientDialog(layout, conn, path),
            editValue: (value, desc, change) => TextEditorPane.openValuePanel(layout, value, desc, change),
          }}
        >
          <BlockDropdown conn={conn} path="Test.database" functionId={functionId} displayName="" canApply={false}>
            <div className="database-header">database</div>
          </BlockDropdown>
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
    const [, div] = loadTemplate(<Template />, 'editor');
    const header = await shouldHappen(() => div.querySelector('.database-header'));
    await userEvent.click(header, {position: {x: 8, y: 8}});
    const rect = header.getBoundingClientRect();
    header.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        view: window,
        button: 2,
        clientX: rect.left + 8,
        clientY: rect.top + 8,
      })
    );
    const menu = await shouldHappen(() =>
      Array.from(
        document.querySelectorAll('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden) .ticl-e-dropdown-menu-item')
      ).find((item) => item.textContent.includes('Manage database'))
    );
    await userEvent.click(menu);
    await shouldHappen(entityTitle);
    expect(layout.find('sql-client-Test.database')).toBeDefined();
    expect(database.listEntities).toHaveBeenCalledOnce();
    expect(database.getColumns).not.toHaveBeenCalled();
    await userEvent.click(entitySwitcher());
    await shouldHappen(() => document.querySelector('.ticl-e-sql-column-type')?.textContent === 'INTEGER');
    expect(database.getColumns).toHaveBeenCalledWith({catalog: undefined, schema: entity.schema, name: entity.name});
    await userEvent.click(entitySwitcher());
    await userEvent.click(entitySwitcher());
    expect(database.getColumns).toHaveBeenCalledOnce();

    await userEvent.fill(editor(), 'SELECT ? AS value');
    await page.getByRole('button', {name: 'Parameters', exact: true}).click();
    await userEvent.click(document.querySelector('.ticl-e-sql-main .ticl-e-expand-button'));
    const valueEditor = await shouldHappen(() =>
      document.querySelector<HTMLElement>('.ticl-e-dock-dialog .cm-content')
    );
    await userEvent.fill(valueEditor, '[42]');
    await page.getByRole('button', {name: 'OK', exact: true}).click();
    expect(database.query).not.toHaveBeenCalled();
    database.query.mockResolvedValueOnce({
      table: {
        columns: [{name: 'value', type: 'any'}],
        rows: Array.from({length: 10000}, (_, index) => [index + 42]),
      },
    });
    await userEvent.click(runButton());
    await shouldHappen(() => document.querySelector('.ticl-e-sql-table .ant-table-row')?.textContent.includes('42'));
    expect(database.query).toHaveBeenCalledWith('SELECT ? AS value', [42]);
    expect(document.querySelectorAll('.ticl-e-sql-table .ant-table-row').length).toBeLessThan(100);
    expect(flow.save()).toEqual(before);
    flushSync(() => openSqlClientDialog(layout, conn, 'Test.database'));
    expect(document.querySelectorAll('.ticl-e-sql-client').length).toBe(1);
    expect(editor().textContent).toBe('SELECT ? AS value');
    expect(document.querySelector('.ticl-e-sql-table')).not.toBeNull();
    expect(database.listEntities).toHaveBeenCalledOnce();
    await userEvent.click(document.querySelector('.ticl-e-sql-entities button'));
    await shouldHappen(() => database.listEntities.mock.calls.length === 2 && entityTitle());
    expect(editor().textContent).toBe('SELECT ? AS value');
    expect(document.querySelector('.ticl-e-sql-table')).not.toBeNull();
    database.query.mockRejectedValueOnce(new Error('bad statement'));
    await userEvent.click(runButton());
    await shouldHappen(() => document.querySelector('.ant-alert')?.textContent.includes('bad statement'));
    expect(document.querySelector('.ticl-e-sql-table')).toBeNull();
    const unsubscribe = vi.spyOn(conn, 'unsubscribe');
    flushSync(() => layout.dockMove(layout.find('sql-client-Test.database') as TabData, null, 'remove'));
    await shouldHappen(() => unsubscribe.mock.calls.some(([path]) => path === 'Test.database.#output'));
    expect(document.querySelector('.ticl-e-sql-client')).toBeNull();
    expect(unsubscribe).toHaveBeenCalledWith('Test.database.#output', expect.anything());
  });

  it('ignores results for an old path or replaced service and prevents overlapping executions', async () => {
    const pending = Promise.withResolvers<SqlResult>();
    const firstService = service(vi.fn().mockReturnValue(pending.promise));
    const secondService = service();
    const flow = root.addFlow('Test', {first: {'#is': functionId}, second: {'#is': functionId}});
    (flow.getValue('first') as Block).output(firstService);
    const second = flow.getValue('second') as Block;
    second.output(secondService);
    const [, conn] = makeLocalConnection(root, false);
    let setPath: (path: string) => void;
    function Template() {
      const [path, update] = React.useState('Test.first');
      setPath = update;
      return <SqlClientDialog conn={conn} path={path} />;
    }
    loadTemplate(<Template />, 'editor');
    await shouldHappen(() => firstService.listEntities.mock.calls.length === 1 && editor());
    await userEvent.fill(editor(), 'SELECT 1');
    await userEvent.click(runButton());
    await shouldHappen(() => firstService.query.mock.calls.length === 1);
    await userEvent.click(editor());
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    expect(firstService.query).toHaveBeenCalledOnce();
    flushSync(() => setPath('Test.second'));
    await shouldHappen(() => secondService.listEntities.mock.calls.length === 1 && !runButton().disabled);
    pending.resolve({table: {columns: [{name: 'old', type: 'any'}], rows: [['stale-result']]}});
    await waitTick(20);
    expect(document.querySelector('.ticl-e-sql-table')).toBeNull();
    await userEvent.click(runButton());
    await shouldHappen(() => document.querySelector('.ticl-e-sql-table .ant-table-row')?.textContent.includes('42'));
    await userEvent.click(entitySwitcher());
    await shouldHappen(() => secondService.getColumns.mock.calls.length === 1);
    const replacement = service();
    second.output(replacement);
    await shouldHappen(() => replacement.listEntities.mock.calls.length === 1 && entityTitle());
    expect(document.querySelector('.ticl-e-sql-table')).toBeNull();
    await userEvent.click(entitySwitcher());
    await shouldHappen(() => replacement.getColumns.mock.calls.length === 1);
  });

  it('drags table, view, and column names into the SQL query editor', async () => {
    const viewEntity = {schema: 'main', name: 'item_view', kind: 'view' as const};
    const database = escapedObject('sql-client-drag-test', {
      listEntities: vi.fn().mockResolvedValue([entity, viewEntity]),
      getColumns: vi.fn().mockResolvedValue([
        {name: 'id', databaseType: 'INTEGER', primaryKey: true},
        {name: 'value', databaseType: 'TEXT'},
      ]),
      query: vi.fn().mockResolvedValue({table: {columns: [{name: 'value', type: 'any'}], rows: [[42]]}}),
    });
    const flow = root.addFlow('Test', {database: {'#is': functionId}});
    (flow.getValue('database') as Block).output(database);
    const [, conn] = makeLocalConnection(root, false);

    let layout: DockLayout;
    const [, div] = loadTemplate(
      <DockLayout
        ref={(value) => {
          layout = value;
        }}
        defaultLayout={{
          dockbox: {mode: 'horizontal', children: [{tabs: [{id: 'base', title: 'Base', content: <div />}]}]},
        }}
        style={{width: 400, height: 500}}
      />,
      'editor'
    );
    div.style.width = '400px';
    div.style.height = '500px';
    await shouldHappen(() => layout);
    flushSync(() => openSqlClientDialog(layout, conn, 'Test.database'));
    await shouldHappen(() => entityTitle() && editor());

    await userEvent.click(entitySwitcher());
    const columnNode = await shouldHappen(() =>
      Array.from(document.querySelectorAll('.ticl-e-sql-column')).find((node) => node.textContent?.includes('value'))
    );
    const idColumnNode = Array.from(document.querySelectorAll('.ticl-e-sql-column')).find((node) =>
      node.textContent?.includes('id')
    );
    const tableNode = document.querySelector<HTMLElement>('.ticl-e-sql-entity');
    const viewNode = Array.from(document.querySelectorAll<HTMLElement>('.ticl-e-sql-entity')).find(
      (node) => node.textContent === viewEntity.name
    );

    // Dragging onto an empty query editor works directly.
    await userEvent.dragAndDrop(columnNode, editor());
    await shouldHappen(() => editor().textContent === 'value');
    // Dropping leaves the caret after the inserted name so subsequent typing appends instead of overwriting it.
    await userEvent.keyboard(' FROM ');
    await userEvent.dragAndDrop(tableNode, editor());
    await shouldHappen(() => editor().textContent === 'value FROM items');
    // Dragging an expanded table keeps its columns expanded.
    expect(document.querySelector('.ticl-e-sql-column')).not.toBeNull();

    // Dragging a view name onto the gutter/wrapper also inserts into the query editor.
    await userEvent.keyboard(' JOIN ');
    await userEvent.dragAndDrop(viewNode, document.querySelector('.ticl-e-sql-input .cm-gutters'));
    await shouldHappen(() => editor().textContent === 'value FROM items JOIN item_view');

    // Dragging a primary-key column inserts only its name at the drop coordinates.
    const line = editor().querySelector('.cm-line');
    const range = document.createRange();
    range.setStart(line.firstChild, 0);
    range.collapse(true);
    const caretRect = range.getBoundingClientRect();
    const data = new DataTransfer();
    idColumnNode.dispatchEvent(new DragEvent('dragstart', {bubbles: true, dataTransfer: data}));
    expect(data.getData('text/plain')).toBe('id');
    editor().dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: data,
        clientX: caretRect.left,
        clientY: (caretRect.top + caretRect.bottom) / 2,
      })
    );
    await shouldHappen(() => editor().textContent === 'idvalue FROM items JOIN item_view');

    // Plain external text/plain drops still work without breaking CodeMirror's native drop handler.
    const plain = new DataTransfer();
    plain.setData('text/plain', ', ');
    range.setStart(editor().querySelector('.cm-line').firstChild, 2);
    range.collapse(true);
    const commaRect = range.getBoundingClientRect();
    editor().dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: plain,
        clientX: commaRect.left,
        clientY: (commaRect.top + commaRect.bottom) / 2,
      })
    );
    await shouldHappen(() => editor().textContent === 'id, value FROM items JOIN item_view');
  });
});
