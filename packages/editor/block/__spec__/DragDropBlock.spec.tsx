import {Modal} from 'antd';
import {DragState} from 'rc-dock';
import {userEvent} from 'vitest/browser';
import {Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {onDropBlock} from '../DragDropBlock.tsx';

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
});
