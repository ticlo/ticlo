import React from 'react';
import {flushSync} from 'react-dom';
import {userEvent} from 'vitest/browser';
import {Root, type ValuePage} from '@ticlo/core';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {truncateData} from '@ticlo/core/util/DataTruncate.ts';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '../../index.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {ObjectTree} from '../ObjectTree.tsx';

describe('ObjectTree paging', () => {
  let root: Root;
  beforeEach(async () => {
    await initEditor();
    root = new Root();
  });
  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    root.destroy();
  });

  function mount(value: unknown, serialize = true) {
    const flow = root.addFlow('Main', {value});
    const [, conn] = makeLocalConnection(root, false, undefined, serialize);
    const getValue = vi.spyOn(conn, 'getValue');
    const getPage = vi.spyOn(conn, 'getValuePage');
    const ref = React.createRef<ObjectTree>();
    let update: (data: object) => void;
    function Template() {
      const [data, setData] = React.useState(truncateData(value, 256)[0]);
      update = (next) => flushSync(() => setData(next));
      return <ObjectTree ref={ref} conn={conn} path="Main.value" data={data} style={{width: 360, height: 260}} />;
    }
    return {
      flow,
      conn,
      getValue,
      getPage,
      ref,
      render: () => loadTemplate(<Template />, 'editor'),
      update: (data: object) => update(data),
    };
  }

  async function scrollToEnd() {
    let holder: HTMLElement;
    await shouldHappen(() => {
      holder = document.querySelector<HTMLElement>('.ticl-e-object-tree .ticl-e-v-scroll');
      return holder && getComputedStyle(holder).overflowY === 'auto' && holder.scrollHeight > holder.clientHeight;
    });
    holder.scrollTop = holder.scrollHeight;
    holder.dispatchEvent(new Event('scroll'));
  }

  it('pages arbitrary rows, detects a mutated local anchor and reloads safely', async () => {
    const rows = Array.from({length: 1005}, (_, id) => ({id}));
    const fixture = mount(rows, false);
    fixture.render();
    await shouldHappen(() => fixture.ref.current?.root.children?.length === 1001);
    expect(fixture.getValue).not.toHaveBeenCalled();
    expect(fixture.getPage).toHaveBeenCalledExactlyOnceWith('Main.value', {select: [], offset: 0, limit: 1000});
    expect(fixture.ref.current.root.children[999].data).toEqual({id: 999});
    (fixture.flow.getValue('value') as typeof rows)[999].id = -1;
    await scrollToEnd();
    await shouldHappen(() => fixture.ref.current.root.error?.includes('Value changed'));
    expect(fixture.getPage.mock.calls[1][1].anchor).toEqual({id: 999});
    await waitTick(20);
    expect(fixture.getPage).toHaveBeenCalledTimes(2);
    await userEvent.click(document.querySelector('.ticl-e-object-tree-more button'));
    await shouldHappen(() => !fixture.ref.current.root.loading && !fixture.ref.current.root.error);
    await shouldHappen(() => fixture.ref.current.root.children.length === 1001);
    await scrollToEnd();
    await shouldHappen(() => fixture.ref.current.root.children.length === 1005);
    expect(fixture.ref.current.root.children.at(-1).data).toEqual({id: 1004});
    expect(fixture.getValue).not.toHaveBeenCalled();
  });

  it('discovers nested arrays without reading their enclosing object and preserves exact keys', async () => {
    const rows = Array.from({length: 1005}, (_, id) => `Row ${id}`);
    const fixture = mount({label: 'Keep', nested: {'rows.data': rows}});
    fixture.render();
    await shouldHappen(() => fixture.ref.current?.root.children?.length === 2);
    const nested = fixture.ref.current.root.children.find((item) => item.name === 'nested');
    nested.open();
    const array = nested.children.find((item) => item.name === 'rows.data');
    expect(array.data.at(-1)).toBe(1005);
    array.open();
    await shouldHappen(() => array.children?.length === 1001);
    expect(fixture.getValue).not.toHaveBeenCalled();
    expect(fixture.getPage).toHaveBeenCalledExactlyOnceWith('Main.value', {
      select: ['nested', 'rows.data'],
      offset: 0,
      limit: 1000,
    });
    expect(array.children[999].name).toBe('999');
    expect(array.children[999].data).toBe('Row 999');
  });

  it('reads arrays shorter than 1000 directly and omits preview metadata from the tree', async () => {
    const fixture = mount(Array.from({length: 999}, (_, id) => id));
    fixture.render();
    await shouldHappen(() => fixture.ref.current?.root.children?.length === 999);
    expect(fixture.getPage).not.toHaveBeenCalled();
    expect(fixture.getValue).toHaveBeenCalledTimes(1);
    expect(fixture.ref.current.root.children.at(-1).data).toBe(998);
  });

  it('ignores a pending page when its source is replaced', async () => {
    const fixture = mount(Array.from({length: 1005}, (_, id) => id));
    let finish: (page: ValuePage) => void;
    fixture.getPage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    fixture.render();
    await shouldHappen(() => Boolean(finish));
    const previous = fixture.ref.current.root;
    fixture.update({replacement: 'Keep'});
    finish({items: [1, 2], offset: 0, total: 1005});
    await waitTick(20);
    expect(fixture.ref.current.root).not.toBe(previous);
    expect(fixture.ref.current.root.children.map((item) => item.data)).toEqual(['Keep']);
    expect(fixture.getPage).toHaveBeenCalledTimes(1);
  });
});
