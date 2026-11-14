import {Modal} from 'antd';
import {DragState} from 'rc-dock';
import {userEvent} from 'vitest/browser';
import {globalFunctions, Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {getDropBlockName, onDropBlock} from '../DragDropBlock.tsx';

describe('block drop name dialog', function () {
  afterEach(async function () {
    Modal.destroyAll();
    await shouldHappen(() => !document.querySelector('.ant-modal'));
    vi.restoreAllMocks();
    removeLastTemplate();
    destroyLastLocalConnection();
  });

  it('selects the initial name and preserves typing and cursor edits after a Shift-drop', async function () {
    const [, conn] = makeLocalConnection(Root.instance);
    const [, background] = loadTemplate(null, 'editor');
    vi.spyOn(DragState, 'getData').mockImplementation((field) => (field === 'blockData' ? {'#is': 'add'} : undefined));
    const createBlock = vi.fn();
    onDropBlock(
      conn,
      {
        clientX: 100,
        clientY: 100,
        event: new MouseEvent('mouseup', {shiftKey: true}),
      } as DragState,
      createBlock,
      background
    );

    const input = await shouldHappen(() => document.querySelector<HTMLInputElement>('.ant-modal input'));
    await shouldHappen(() => document.activeElement === input);
    expect(input.value).toBe('add');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    expect(createBlock).not.toHaveBeenCalled();

    await userEvent.keyboard('newName');
    expect(input.value).toBe('newName');
    expect(input.selectionStart).toBe(input.value.length);
    expect(input.selectionEnd).toBe(input.value.length);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}_');
    expect(input.value).toBe('new_Name');

    await userEvent.keyboard('{Enter}');
    expect(createBlock).toHaveBeenCalledExactlyOnceWith('new_Name', expect.objectContaining({'#is': 'add'}), false);
  });

  it('prefixes ^ only when dropping context-service blocks directly into #global or library #context', async function () {
    const [, conn] = makeLocalConnection(Root.instance);
    const [, background] = loadTemplate(null, 'editor');
    const serviceDesc = globalFunctions.getDesc('http:client');
    expect(serviceDesc.tags).toEqual(['http-client', 'context-service']);

    const mockDrag = (values: Record<string, unknown>) =>
      vi.spyOn(DragState, 'getData').mockImplementation((field) => values[field]);
    const dropEvent = (init: MouseEventInit = {}) =>
      ({
        clientX: 100,
        clientY: 100,
        event: new MouseEvent('mouseup', init),
      }) as DragState;

    const spy = mockDrag({blockData: {'#is': 'http:client'}, blockName: 'client', functionDesc: serviceDesc});
    const createBlock = vi.fn();
    onDropBlock(conn, dropEvent(), createBlock, background, '#global');
    onDropBlock(conn, dropEvent(), createBlock, background, '+myLib.#context');
    onDropBlock(conn, dropEvent(), createBlock, background, 'MainFlow');
    onDropBlock(conn, dropEvent(), createBlock, background, '#global.nested');
    onDropBlock(conn, dropEvent({altKey: true}), createBlock, background, '#global');
    expect(createBlock.mock.calls.map(([name, , isStatic]) => [name, isStatic])).toEqual([
      ['^client', false],
      ['^client', false],
      ['client', false],
      ['client', false],
      ['client', true],
    ]);

    spy.mockImplementation(
      (field) =>
        (
          ({
            blockData: {'#is': 'http:client'},
            blockName: '^already',
            functionDesc: serviceDesc,
          }) as Record<string, unknown>
        )[field]
    );
    expect(getDropBlockName(conn, dropEvent(), '#global')).toBe('^already');

    spy.mockImplementation(
      (field) =>
        (
          ({
            blockData: {'#is': 'add'},
            blockName: 'add',
            functionDesc: globalFunctions.getDesc('add'),
          }) as Record<string, unknown>
        )[field]
    );
    expect(getDropBlockName(conn, dropEvent(), '#global')).toBe('add');
    expect(getDropBlockName(conn, dropEvent(), '+myLib.#context')).toBe('add');

    spy.mockImplementation(
      (field) =>
        (
          ({
            blockData: {'#is': 'http:client'},
            blockName: 'client',
            functionDesc: serviceDesc,
          }) as Record<string, unknown>
        )[field]
    );
    createBlock.mockClear();
    onDropBlock(conn, dropEvent({shiftKey: true}), createBlock, background, '+myLib.#context');
    const input = await shouldHappen(() => document.querySelector<HTMLInputElement>('.ant-modal input'));
    await shouldHappen(() => document.activeElement === input);
    expect(input.value).toBe('^client');
    await userEvent.keyboard('api{Enter}');
    expect(createBlock).toHaveBeenCalledExactlyOnceWith('^api', expect.objectContaining({'#is': 'http:client'}), false);
  });
});
