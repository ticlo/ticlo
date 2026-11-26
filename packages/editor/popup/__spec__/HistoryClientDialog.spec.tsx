import React from 'react';
import {flushSync} from 'react-dom';
import {userEvent} from 'vitest/browser';
import {DockLayout, type TabData} from 'rc-dock';
import {DateTime} from 'luxon';
import {
  Root,
  escapedObject,
  globalFunctions,
  historyClientApi,
  historyClientCommands,
  type Block,
  type HistoryQueryResult,
  type HistorySeriesInfo,
} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '../../index.ts';
import {TicloLayoutContextType} from '../../component/LayoutContext.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {BlockDropdown} from '../BlockDropdown.tsx';
import {HistoryClientDialog, openHistoryClientDialog} from '../HistoryClientDialog.tsx';

const functionId = 'history-client-dialog-test';
globalFunctions.addFactory(
  null,
  {name: functionId, tags: ['history-client'], commands: historyClientCommands, properties: []},
  undefined,
  historyClientApi
);

function makeService(
  series: HistorySeriesInfo[] = [
    {id: 'plant.temp', kind: 'number', raw: true, rollup1h: true, rollup1d: true},
    {id: 'plant.valve', kind: 'boolean', raw: true, rollup1h: true, rollup1d: true},
    {id: 'audit.log', kind: 'value', raw: true},
  ],
  query = vi.fn().mockImplementation(async (opts: {id: string; rollup?: string}) => ({
    table: {
      columns: [
        {name: 'time', type: 'date'},
        {name: 'value', type: 'number'},
      ],
      rows: [[DateTime.fromMillis(1_700_000_000_000, {zone: 'utc'}), opts.rollup === 'max' ? 99 : 42]],
    },
    kind: 'number',
    interval: '1h',
    truncated: false,
    timezone: 'UTC',
  }))
) {
  return escapedObject('history-client-test', {
    timezone: 'UTC',
    listSeries: vi
      .fn()
      .mockImplementation((search?: string) =>
        search ? series.filter((s) => s.id.toLowerCase().includes(search.toLowerCase())) : series
      ),
    query,
  });
}

describe('History client management dialog', () => {
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

  it('opens from BlockDropdown, filters histories by search, queries with selected rollup, and handles errors cleanly', async () => {
    const historyService = makeService();
    const flow = root.addFlow('Test', {history: {'#is': functionId}});
    (flow.getValue('history') as Block).output(historyService);
    const [, conn] = makeLocalConnection(root, true);
    await shouldHappen(() => conn.watchDesc(functionId)?.tags?.includes('history-client'));
    const before = flow.save();

    let layout: DockLayout;
    function Template() {
      return (
        <TicloLayoutContextType.Provider
          value={{
            manageHistory: (c, p) => openHistoryClientDialog(layout, c, p),
          }}
        >
          <BlockDropdown conn={conn} path="Test.history" functionId={functionId} displayName="" canApply={false}>
            <div className="history-header">history</div>
          </BlockDropdown>
          <DockLayout
            ref={(value) => {
              layout = value;
            }}
            defaultLayout={{
              dockbox: {mode: 'horizontal', children: [{tabs: [{id: 'base', title: 'Base', content: <div />}]}]},
            }}
            style={{width: 1100, height: 800}}
          />
        </TicloLayoutContextType.Provider>
      );
    }

    const [, div] = loadTemplate(<Template />, 'editor');
    await shouldHappen(() => div.querySelector('.history-header'));
    div.querySelector('.history-header').dispatchEvent(new MouseEvent('contextmenu', {bubbles: true}));
    const menuItem = await shouldHappen(() =>
      Array.from(document.querySelectorAll('.ticl-e-dropdown-menu-item')).find((item) =>
        item.textContent.includes('Manage history')
      )
    );
    await userEvent.click(menuItem);

    await shouldHappen(() => document.querySelectorAll('.ticl-e-history-item').length === 3);
    expect(layout.find('history-client-Test.history')).toBeDefined();
    expect(historyService.listSeries).toHaveBeenCalledOnce();

    // Filter left list by search input.
    const searchInput = document.querySelector<HTMLInputElement>('.ticl-e-history-search input');
    await userEvent.fill(searchInput, 'valve');
    await shouldHappen(() => document.querySelectorAll('.ticl-e-history-item').length === 1);
    expect(document.querySelector('.ticl-e-history-item-id')?.textContent).toBe('plant.valve');

    // Clear search and click plant.temp to run initial query.
    await userEvent.fill(searchInput, '');
    await shouldHappen(() => document.querySelectorAll('.ticl-e-history-item').length === 3);
    await userEvent.click(document.querySelector('.ticl-e-history-item'));

    await shouldHappen(() =>
      document.querySelector('.ticl-e-history-table .ant-table-row')?.textContent.includes('42')
    );
    expect(historyService.query).toHaveBeenCalledTimes(1);

    // Change Rollup option to max and verify query updates the table.
    const rollupSelect = document.querySelector<HTMLElement>('.ticl-e-history-rollup-select');
    await userEvent.click(rollupSelect);
    const maxOption = await shouldHappen(() =>
      Array.from(document.querySelectorAll('.ant-select-item-option-content')).find((el) => el.textContent === 'max')
    );
    await userEvent.click(maxOption);

    await shouldHappen(() =>
      document.querySelector('.ticl-e-history-table .ant-table-row')?.textContent.includes('99')
    );
    expect(historyService.query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'plant.temp',
        rollup: 'max',
      })
    );

    // Re-calling openHistoryClientDialog activates the existing tab rather than duplicating it.
    flushSync(() => openHistoryClientDialog(layout, conn, 'Test.history'));
    expect(document.querySelectorAll('.ticl-e-history-client').length).toBe(1);

    // Refresh button reloads series list.
    await userEvent.click(document.querySelector('.ticl-e-history-list button'));
    await shouldHappen(() => historyService.listSeries.mock.calls.length === 2);

    // Error handling displays Alert and clears stale table.
    historyService.query.mockRejectedValueOnce(new Error('history read failed'));
    await userEvent.click(document.querySelector<HTMLButtonElement>('.ticl-e-history-controls .ant-btn-primary'));
    await shouldHappen(() => document.querySelector('.ant-alert')?.textContent.includes('history read failed'));
    expect(document.querySelector('.ticl-e-history-table')).toBeNull();
    expect(flow.save()).toEqual(before);

    // Closing dialog unsubscribes cleanly.
    const unsubscribe = vi.spyOn(conn, 'unsubscribe');
    flushSync(() => layout.dockMove(layout.find('history-client-Test.history') as TabData, null, 'remove'));
    await shouldHappen(() => unsubscribe.mock.calls.some(([p]) => p === 'Test.history.#output'));
    expect(document.querySelector('.ticl-e-history-client')).toBeNull();
  });

  it('ignores stale query results when path or service changes', async () => {
    const pending = Promise.withResolvers<HistoryQueryResult>();
    const firstService = makeService([{id: 's1', kind: 'number'}], vi.fn().mockReturnValue(pending.promise));
    const secondService = makeService([{id: 's2', kind: 'number'}]);
    const flow = root.addFlow('Test', {first: {'#is': functionId}, second: {'#is': functionId}});
    (flow.getValue('first') as Block).output(firstService);
    (flow.getValue('second') as Block).output(secondService);
    const [, conn] = makeLocalConnection(root, false);

    let setPath: (path: string) => void;
    function Template() {
      const [path, update] = React.useState('Test.first');
      setPath = update;
      return <HistoryClientDialog conn={conn} path={path} />;
    }

    const [, div] = loadTemplate(<Template />, 'editor');
    div.style.width = '1000px';
    div.style.height = '600px';
    await shouldHappen(() => document.querySelector('.ticl-e-history-item-id')?.textContent === 's1');
    await userEvent.click(document.querySelector('.ticl-e-history-item'));
    await shouldHappen(() => firstService.query.mock.calls.length === 1);

    flushSync(() => setPath('Test.second'));
    await shouldHappen(() => document.querySelector('.ticl-e-history-item-id')?.textContent === 's2');

    pending.resolve({
      table: {
        columns: [
          {name: 'time', type: 'date'},
          {name: 'value', type: 'number'},
        ],
        rows: [[DateTime.fromMillis(1_700_000_000_000), 999]],
      },
      kind: 'number',
      interval: '1h',
      truncated: false,
      timezone: 'UTC',
    });
    await waitTick(20);
    expect(document.querySelector('.ticl-e-history-table')).toBeNull();
    const runBtn = document.querySelector<HTMLButtonElement>('.ticl-e-history-controls .ant-btn-primary');
    await shouldHappen(() => runBtn && !runBtn.disabled);
    await userEvent.click(runBtn);
    await shouldHappen(() =>
      document.querySelector('.ticl-e-history-table .ant-table-row')?.textContent.includes('42')
    );
  });
});
