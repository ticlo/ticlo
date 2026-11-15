import React, {useState} from 'react';
import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import {userEvent} from 'vitest/browser';
import {blankFuncDesc, blankPropDesc} from '@ticlo/core';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '../../../index.ts';
import {TicloLayoutContextType, type TicloFilesAccess} from '../../../component/LayoutContext.ts';
import {file, folder, fixtureClient} from '../../../file-manager/__spec__/fixtures.ts';
import {loadTemplate, removeLastTemplate} from '../../../util/test-util.ts';
import {FilePathEditor} from '../FilePathEditor.tsx';

function ControlledEditor({
  initialValue,
  keys = ['+main.flow.block'],
  files,
  onValues,
}: {
  initialValue?: string;
  keys?: string[];
  files?: TicloFilesAccess;
  onValues?: (val: unknown) => void;
}) {
  const [value, setValue] = useState<unknown>(initialValue);
  return (
    <TicloLayoutContextType.Provider value={files ? {getFiles: () => files} : {}}>
      <FilePathEditor
        keys={keys}
        name="file"
        value={value}
        funcDesc={blankFuncDesc}
        desc={{name: 'file', type: 'file-path'} as typeof blankPropDesc}
        onChange={(next) => {
          setValue(next);
          onValues?.(next);
        }}
      />
    </TicloLayoutContextType.Provider>
  );
}

describe('FilePathEditor', () => {
  beforeEach(async () => {
    await initEditor();
  });

  afterEach(() => {
    removeLastTemplate();
  });

  it('handles +/ display stripping, 3 addon states, and manual toggle', async () => {
    const committed: unknown[] = [];
    const [, div] = loadTemplate(
      <ControlledEditor initialValue="+/assets/logo.png" onValues={(v) => committed.push(v)} />,
      'editor'
    );

    const input = () => div.querySelector<HTMLInputElement>('input');
    const addon = () => div.querySelector<HTMLButtonElement>('.ticl-e-file-path-addon');

    await shouldHappen(() => input()?.value === 'assets/logo.png');
    expect(div.querySelector('.ticl-e-expand-button')).toBeNull();
    expect(addon()).not.toBeNull();
    expect(addon().textContent).toBe('+/');
    expect(addon().classList.contains('ticl-e-file-path-addon-raw')).toBe(false);

    // Editing a plain relative name keeps +/ addon and commits +/...
    await userEvent.fill(input(), 'images/icon.png');
    await userEvent.keyboard('{Enter}');
    expect(committed.at(-1)).toBe('+/images/icon.png');
    expect(input().value).toBe('images/icon.png');

    // Clicking the +/ addon switches to red "?" mode and removes +/ prefix.
    await userEvent.click(addon());
    expect(committed.at(-1)).toBe('images/icon.png');
    await shouldHappen(() => addon()?.classList.contains('ticl-e-file-path-addon-raw'));
    expect(addon().textContent).toBe('?');
    expect(input().value).toBe('images/icon.png');

    // While addon is red, committing text does not auto-prepend +/.
    await userEvent.fill(input(), 'custom-raw.txt');
    await userEvent.keyboard('{Enter}');
    expect(committed.at(-1)).toBe('custom-raw.txt');
    expect(addon().classList.contains('ticl-e-file-path-addon-raw')).toBe(true);
    expect(addon().textContent).toBe('?');

    // Clicking the red "?" addon re-enables +/ and prepends +/ to the committed value.
    await userEvent.click(addon());
    expect(committed.at(-1)).toBe('+/custom-raw.txt');
    await shouldHappen(() => !addon()?.classList.contains('ticl-e-file-path-addon-raw'));
    expect(addon().textContent).toBe('+/');

    // Entering case 1, 2, or 3 paths hides the addon and commits verbatim.
    for (const sample of [
      'https://a.com/x.png',
      '//cdn.a.com/x.png',
      '/abs/x.png',
      './rel.png',
      '../up.png',
      '+other/x.png',
    ]) {
      await userEvent.fill(input(), sample);
      await shouldHappen(() => addon() === null);
      await userEvent.keyboard('{Enter}');
      expect(committed.at(-1)).toBe(sample);
    }

    // Clearing to empty restores normal +/ addon and commits empty string without +/.
    await userEvent.clear(input());
    await shouldHappen(() => addon() !== null && !addon().classList.contains('ticl-e-file-path-addon-raw'));
    await userEvent.keyboard('{Enter}');
    expect(committed.at(-1)).toBe('');

    // Pasting +/directly strips +/ in the input and keeps normal +/ addon.
    await userEvent.fill(input(), '+/pasted.txt');
    await shouldHappen(() => input().value === 'pasted.txt');
    expect(addon().classList.contains('ticl-e-file-path-addon-raw')).toBe(false);
    await userEvent.keyboard('{Enter}');
    expect(committed.at(-1)).toBe('+/pasted.txt');
  });

  it('starts in red addon state when initial value belongs to none of the 4 cases', async () => {
    const committed: unknown[] = [];
    const [, div] = loadTemplate(
      <ControlledEditor initialValue="unclassified.txt" onValues={(v) => committed.push(v)} />,
      'editor'
    );
    const input = () => div.querySelector<HTMLInputElement>('input');
    const addon = () => div.querySelector<HTMLButtonElement>('.ticl-e-file-path-addon');

    await shouldHappen(() => input()?.value === 'unclassified.txt');
    expect(addon()?.classList.contains('ticl-e-file-path-addon-raw')).toBe(true);
    expect(addon()?.textContent).toBe('?');

    await userEvent.fill(input(), 'still-raw.txt');
    await userEvent.keyboard('{Enter}');
    expect(committed.at(-1)).toBe('still-raw.txt');
    expect(addon().classList.contains('ticl-e-file-path-addon-raw')).toBe(true);
    expect(addon().textContent).toBe('?');
  });

  it('opens an Antd file browser modal and allows switching across projects', async () => {
    const fixture = fixtureClient([file('main/logo.png'), folder('other/shared'), file('other/shared/doc.json')]);
    const storage = Object.assign(fixture.client, {
      listProjects: async () => [{id: 'main'}, {id: 'other'}],
    });
    const committed: unknown[] = [];
    const [, div] = loadTemplate(
      <ControlledEditor initialValue="" files={{storage, project: 'main'}} onValues={(v) => committed.push(v)} />,
      'editor'
    );

    const browseBtn = await shouldHappen(() => div.querySelector<HTMLButtonElement>('.ticl-e-file-path-browse'));
    await userEvent.click(browseBtn);

    // Wait for modal and main project file row, then select it via OK button.
    const row = (path: string) => document.querySelector<HTMLElement>(`.ticl-e-file-row[data-path="${path}"]`);
    await shouldHappen(() => row('main/logo.png'));
    await userEvent.click(row('main/logo.png'));
    const okBtn = () => document.querySelector<HTMLButtonElement>('.ant-modal-footer .ant-btn-primary');
    await shouldHappen(() => okBtn() && !okBtn().disabled);
    await userEvent.click(okBtn());

    await shouldHappen(() => committed.at(-1) === '+/logo.png');
    expect(div.querySelector<HTMLInputElement>('input').value).toBe('logo.png');

    // Re-open modal after close transition finishes, switch project to "other", and double-click a file inside it.
    await shouldHappen(() => !document.querySelector('.ant-modal-root'));
    await userEvent.click(browseBtn);
    const select = await shouldHappen(() =>
      document.querySelector<HTMLElement>('.ticl-e-file-picker-project .ant-select')
    );
    await userEvent.click(select);
    const otherOption = await shouldHappen(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option')).find((el) =>
        el.textContent?.includes('other')
      )
    );
    await userEvent.click(otherOption);

    await shouldHappen(() => row('other/shared'));
    await userEvent.dblClick(row('other/shared'));
    await shouldHappen(() => row('other/shared/doc.json'));
    await userEvent.dblClick(row('other/shared/doc.json'));

    await shouldHappen(() => committed.at(-1) === '+other/shared/doc.json');
    expect(div.querySelector<HTMLInputElement>('input').value).toBe('+other/shared/doc.json');
  });
});
