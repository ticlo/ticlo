import React from 'react';
import {userEvent} from 'vitest/browser';
import {
  Root,
  escapedObject,
  makeLocalConnection,
  shouldHappen,
  type LiveExplorer,
  type LiveObserver,
  type LiveQueryEvent,
} from '@ticlo/core';
import {initEditor} from '../../index.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {LiveExplorerDialog} from '../LiveExplorerDialog.tsx';

const rows = Array.from({length: 80}, (_, index) => ({
  id: 'record-' + index,
  label: 'Record ' + index,
  target: 'record-' + index,
  preview: 'cached ' + index,
}));
const list = () => document.querySelector<HTMLElement>('.ticl-e-live-list');
const row = (id: string) => document.querySelector('[data-live-row="' + id + '"]');
const button = (name: string) =>
  Array.from(document.querySelectorAll('button')).find((element) => element.textContent === name);

it('subscribes only virtual rows in tree and search, and releases listeners on hide and close', async () => {
  await initEditor();
  const observers = new Map<string, LiveObserver>();
  const explorer: LiveExplorer = {
    describe: () => ({tree: true, search: {fields: []}, liveRows: true}),
    listChildren: (parent) => (parent === undefined ? {rows: [{id: 'root', label: 'Root', branch: 'root'}]} : {rows}),
    search: () => ({rows}),
    watchRow: (target, observer) => {
      observers.set(target, observer);
      observer({type: 'snapshot', value: target});
      return {close: () => observers.delete(target)};
    },
  };
  const root = new Root();
  root.defineGlobal('live', {'#output': escapedObject('live:test', {liveExplorer: explorer})});
  const [, conn] = makeLocalConnection(root, false, {readonly: true});
  try {
    loadTemplate(
      <div className="test-live-panel" style={{height: 250}}>
        <LiveExplorerDialog conn={conn} path="#global.^live" />
      </div>,
      'editor'
    );
    const expand = await shouldHappen(() => row('root')?.querySelector('button'));
    await userEvent.click(expand);
    await shouldHappen(() => observers.has('record-0'));
    expect(observers.size).toBeLessThan(20);
    expect(observers.has('record-79')).toBe(false);
    const retired = observers.get('record-0');
    retired({type: 'update', value: 'live update'});
    await shouldHappen(() => row('record-0')?.textContent.includes('live update'));

    list().scrollTo(0, list().scrollHeight);
    await shouldHappen(() => observers.has('record-79') && !observers.has('record-0'));
    expect(observers.size).toBeLessThan(20);

    await userEvent.click(button('Search'));
    await shouldHappen(() => observers.size === 0 && row('record-0'));
    await userEvent.click(button('Resume live'));
    await shouldHappen(() => observers.has('record-0') && !observers.has('record-79'));
    expect(observers.size).toBeLessThan(20);
    retired({type: 'update', value: 'late tree update'});
    await conn.getLiveCapabilities('#global.^live');
    expect(row('record-0')?.textContent).not.toContain('late tree update');
    const panel = document.querySelector<HTMLElement>('.test-live-panel');
    panel.style.display = 'none';
    await shouldHappen(() => observers.size === 0);
    panel.style.display = '';
    await shouldHappen(() => observers.has('record-0'));
    removeLastTemplate();
    await shouldHappen(() => observers.size === 0);
  } finally {
    removeLastTemplate();
    conn.destroy();
    root.destroy();
  }
});

it('shows an explicitly enabled bounded live query and updates its result membership', async () => {
  await initEditor();
  let observer: (event: LiveQueryEvent) => void;
  const explorer: LiveExplorer = {
    describe: () => ({search: {fields: []}, liveQuery: true}),
    search: () => ({rows: rows.slice(0, 1)}),
    watchQuery: (_query, limit, update) => {
      expect(limit).toBe(100);
      observer = update;
      update({type: 'results', rows: rows.slice(0, 1)});
      return {
        close: () => {
          observer = undefined;
        },
      };
    },
  };
  const root = new Root();
  root.defineGlobal('live', {'#output': escapedObject('live:test', {liveExplorer: explorer})});
  const [, conn] = makeLocalConnection(root, false);
  try {
    loadTemplate(
      <div style={{height: 250}}>
        <LiveExplorerDialog conn={conn} path="#global.^live" />
      </div>,
      'editor'
    );
    await shouldHappen(() => row('record-0'));
    expect(button('Tree')).toBeUndefined();
    expect(observer).toBeUndefined();
    await userEvent.click(button('Run live query'));
    await shouldHappen(() => observer);
    observer({type: 'results', rows: rows.slice(1, 2)});
    await shouldHappen(() => row('record-1') && !row('record-0'));
    await userEvent.click(button('Pause live query'));
    await shouldHappen(() => !observer && row('record-0'));
  } finally {
    removeLastTemplate();
    conn.destroy();
    root.destroy();
  }
});
