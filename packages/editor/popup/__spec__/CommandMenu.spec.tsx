import React from 'react';
import {flushSync} from 'react-dom';
import {page, userEvent} from 'vitest/browser';
import {DockLayout} from 'rc-dock';
import {Root, globalFunctions, type FunctionCommandDesc} from '@ticlo/core';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '../../index.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {TicloLayoutContextType} from '../../component/LayoutContext.ts';
import {EditPolicyProvider} from '../../component/EditPolicyContext.tsx';
import {TextEditorPane} from '../../dock/text-editor/TextEditorPane.tsx';
import {TableEditor} from '../../property/value/TableEditor.tsx';
import {BlockDropdown} from '../BlockDropdown.tsx';
import {PropertyDropdown} from '../PropertyDropdown.tsx';
import {CommandMenu} from '../CommandMenu.tsx';

const functionId = 'command-menu-test';
const commandDesc: FunctionCommandDesc = {
  parameters: [
    {name: 'text', type: 'string', default: 'seed'},
    {name: 'config', type: 'object', init: {value: 2}},
    {name: 'catalog', type: 'string'},
    {name: 'schema', type: 'string', default: 'main'},
    {name: 'name', type: 'string', default: 'original'},
  ],
  results: [
    {name: 'count', type: 'number'},
    {name: 'message', type: 'string'},
    {name: 'table', type: 'table'},
  ],
  largeData: true,
};
const execute = vi.fn();
globalFunctions.addFactory(null, {name: functionId, properties: [], commands: {inspect: commandDesc}}, undefined, {
  commands: {inspect: (block, params) => execute(block.getFullPath(), params)},
});

function panel() {
  return Array.from(document.querySelectorAll<HTMLElement>('.ticl-e-command-menu')).find(
    (element) =>
      element.getBoundingClientRect().height > 0 &&
      element.getBoundingClientRect().top >= 0 &&
      getComputedStyle(element).visibility === 'visible'
  );
}
function field(name: string, root: Element = panel()) {
  return Array.from(root.querySelectorAll<HTMLElement>('.ticl-e-property')).find(
    (element) => element.querySelector('.ticl-e-property-name')?.textContent.toLowerCase() === name.toLowerCase()
  );
}
const runButton = () => panel().querySelector<HTMLButtonElement>('.ticl-e-command-actions button');
async function open(header: Element) {
  await userEvent.click(header, {timeout: 2000});
  const rect = header.getBoundingClientRect();
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    view: window,
    button: 2,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  });
  header.dispatchEvent(event);
  const item = await shouldHappen(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.ticl-e-dropdown-menu-item')).find(
      (item) =>
        item.textContent.trim() === 'inspect' &&
        item.getBoundingClientRect().height > 0 &&
        item.getBoundingClientRect().top >= 0 &&
        getComputedStyle(item).visibility === 'visible'
    )
  );
  if (!item.classList.contains('ticl-e-dropdown-menu-item-active')) item.click();
  await shouldHappen(() => panel());
}

describe('Command menus', () => {
  let root: Root;
  beforeEach(async () => {
    await initEditor();
    root = new Root();
    execute.mockReset();
  });
  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    root.destroy();
    vi.restoreAllMocks();
  });

  it('edits local drafts, executes explicitly, and reuses local editors for named readonly results', async () => {
    const flow = root.addFlow('Test', {block: {'#is': functionId, 'value': 12}});
    const before = flow.save();
    const [, conn] = makeLocalConnection(root, true);
    await shouldHappen(() => conn.watchDesc(functionId));
    let layout: DockLayout;
    loadTemplate(
      <TicloLayoutContextType.Provider
        value={{
          editValue: (value, desc, change) => TextEditorPane.openValuePanel(layout, value, desc, change),
          editTable: (props) => TableEditor.openFloatPanel(layout, props),
        }}
      >
        <BlockDropdown conn={conn} path="Test.block" functionId={functionId} displayName="" canApply={false}>
          <div className="command-header">block</div>
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
      </TicloLayoutContextType.Provider>,
      'editor'
    );
    const header = await shouldHappen(() => document.querySelector('.command-header'));
    await open(header);
    const get = vi.spyOn(conn, 'getValue');
    const pageRead = vi.spyOn(conn, 'getValuePage');
    const set = vi.spyOn(conn, 'setValue');
    const request = vi.spyOn(conn, 'executeCommand');
    expect(field('text').querySelector('textarea').value).toBe('seed');
    await userEvent.fill(field('text').querySelector('textarea'), 'changed');
    await userEvent.fill(field('name').querySelector('textarea'), 'items');
    expect(execute).not.toHaveBeenCalled();
    await userEvent.click(field('config').querySelector('.ticl-e-expand-button'));
    const code = await shouldHappen(() => document.querySelector<HTMLElement>('.cm-content'));
    await userEvent.fill(code, '{"value":7}');
    await page.getByRole('button', {name: 'OK', exact: true}).click();
    await shouldHappen(() => !document.querySelector('.cm-content'));
    await open(header);
    expect(field('config').textContent).toContain('7');
    const table = {columns: [{name: 'id', type: 'number'}], rows: Array.from({length: 10000}, (_, i) => [i])};
    execute.mockResolvedValueOnce({count: 0, message: 'answer', table});
    await userEvent.click(runButton());
    await shouldHappen(() => panel()?.querySelector('.ticl-e-command-results'));
    expect(execute).toHaveBeenCalledWith('Test.block', {
      text: 'changed',
      config: {value: 7},
      catalog: undefined,
      schema: 'main',
      name: 'items',
    });
    expect(request).toHaveBeenCalledWith(
      'Test.block',
      'inspect',
      expect.anything(),
      undefined,
      expect.objectContaining({largeData: true})
    );
    const results = panel().querySelector('.ticl-e-command-results');
    expect(field('count', results).querySelector('input').value).toBe('0');
    expect(field('message', results).querySelector('textarea').value).toBe('answer');
    expect(field('message', results).querySelector('textarea').disabled).toBe(true);
    await userEvent.click(field('table', results).querySelector('button'));
    await shouldHappen(() => document.querySelector('.ticl-e-table-editor .ant-table-row'));
    expect(document.querySelectorAll('.ticl-e-table-editor .ant-table-row').length).toBeLessThan(100);
    expect(get).not.toHaveBeenCalled();
    expect(pageRead).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(flow.save()).toEqual(before);
    await page.getByRole('button', {name: 'Close', exact: true}).click();
    await shouldHappen(() => !document.querySelector('.ticl-e-table-editor'));
    await open(header);
    execute.mockRejectedValueOnce(new Error('command failed'));
    await userEvent.click(runButton());
    await shouldHappen(() => panel()?.querySelector('.ticl-e-error-message')?.textContent.includes('command failed'));
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('keeps property command results per target, prevents duplicate runs, and enforces changed permissions', async () => {
    root.addFlow('Test', {first: {'#is': functionId}, second: {'#is': functionId}});
    const [server, conn] = makeLocalConnection(root, true);
    const pending = Promise.withResolvers<unknown>();
    execute.mockImplementation((path) =>
      path === 'Test.first' ? pending.promise : Promise.reject(new Error('second failed'))
    );
    loadTemplate(
      <EditPolicyProvider conn={conn}>
        <PropertyDropdown
          conn={conn}
          paths={['Test.first', 'Test.second']}
          name="value"
          display
          funcDesc={globalFunctions.getDesc(functionId)}
          propDesc={{name: 'value', type: 'any', commands: {inspect: commandDesc}}}
          bindingPath=""
          onAddSubBlock={() => {}}
        >
          <div className="command-header">property</div>
        </PropertyDropdown>
      </EditPolicyProvider>,
      'editor'
    );
    const header = await shouldHappen(() => document.querySelector('.command-header'));
    await open(header);
    await userEvent.click(runButton());
    await shouldHappen(() => execute.mock.calls.length === 2);
    await userEvent.click(runButton());
    expect(execute).toHaveBeenCalledTimes(2);
    pending.resolve({count: 3, message: 'first result'});
    await shouldHappen(() => panel()?.querySelector('.ticl-e-error-message')?.textContent.includes('second failed'));
    expect(panel().textContent).toContain('Test.first');
    expect(panel().textContent).toContain('Test.second');
    expect(field('message', panel().querySelector('.ticl-e-command-results')).querySelector('textarea').value).toBe(
      'first result'
    );
    expect(execute.mock.calls.every(([, params]) => params.property === 'value')).toBe(true);
    server.setEditPolicy({readonly: true});
    await shouldHappen(() => !panel() || runButton().disabled);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('discards results and local editor callbacks for an old target', async () => {
    root.addFlow('Test', {first: {'#is': functionId}, second: {'#is': functionId}});
    const [, conn] = makeLocalConnection(root, false);
    const pending = Promise.withResolvers<unknown>();
    execute.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({count: 2, message: 'current'});
    let setPath: (path: string) => void;
    let oldChange: (value: unknown) => void;
    function Template() {
      const [path, update] = React.useState('Test.first');
      setPath = update;
      return (
        <TicloLayoutContextType.Provider
          value={{
            editValue: (_value, _desc, change) => {
              oldChange = change;
            },
          }}
        >
          <CommandMenu conn={conn} paths={[path]} command="inspect" desc={commandDesc} funcDesc={{name: functionId}} />
        </TicloLayoutContextType.Provider>
      );
    }
    loadTemplate(<Template />, 'editor');
    await shouldHappen(() => panel());
    await userEvent.click(field('config').querySelector('.ticl-e-expand-button'));
    await userEvent.click(runButton());
    await shouldHappen(() => execute.mock.calls.length === 1);
    flushSync(() => setPath('Test.second'));
    oldChange({value: 999});
    pending.resolve({message: 'stale'});
    await waitTick(20);
    expect(panel().querySelector('.ticl-e-command-results')).toBeNull();
    await userEvent.click(runButton());
    await shouldHappen(() => panel()?.querySelector('.ticl-e-command-results'));
    expect(execute.mock.calls[1]).toEqual([
      'Test.second',
      {text: 'seed', config: {value: 2}, catalog: undefined, schema: 'main', name: 'original'},
    ]);
  });
});
