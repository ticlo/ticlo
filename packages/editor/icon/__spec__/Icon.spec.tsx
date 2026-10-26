import {expect} from 'vitest';
import React, {StrictMode, useState} from 'react';
import {TIcon} from '../Icon.tsx';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {removeLastTemplate, loadTemplate} from '../../util/test-util.ts';

function rulesFor(className: string) {
  return document.adoptedStyleSheets
    .flatMap((sheet) => [...sheet.cssRules])
    .filter((rule) => rule instanceof CSSStyleRule && rule.selectorText === `.${className}`);
}

describe('editor Icon', () => {
  afterEach(removeLastTemplate);

  it('renders one background below multiple text layers without truncating text', async () => {
    const [, div] = loadTemplate(
      <div>
        <TIcon icon="tl^:s  svg:react  br^:2  :A" />
        <TIcon icon="13^:long text" />
        <TIcon icon="svg:clock  svg:calendar  t:add" />
        <TIcon icon="unknown:invalid" />
      </div>,
      'editor'
    );
    await shouldHappen(() => div.querySelectorAll('.tico').length === 4);
    const icons = div.querySelectorAll('.tico');
    expect(icons[0].firstElementChild.className).toBe('tico-icon-svg tico-svg-react');
    expect([...icons[0].querySelectorAll('.tico-txt')].map((text) => text.textContent)).toEqual(['s', '2', 'A']);
    expect(icons[1].textContent).toBe('long text');
    expect(icons[1].querySelector('.tico-icon-svg')).toBeNull();
    expect(icons[2].querySelectorAll('.tico-icon-svg').length).toBe(1);
    expect(icons[2].querySelector('.tico-svg-clock')).not.toBeNull();
    expect(icons[3].children.length).toBe(0);
  });

  it('shares path classes and releases temporary CSS when the path changes or unmounts', async () => {
    let changePath: React.Dispatch<React.SetStateAction<string>>;
    function Example() {
      const [path, setPath] = useState('M0 0L96 96L0 96Z');
      changePath = setPath;
      return (
        <>
          <TIcon icon={`path:${path}  t:A`} />
          <TIcon icon={`b:B  path:${path}`} />
        </>
      );
    }
    const [, div] = loadTemplate(
      <StrictMode>
        <Example />
      </StrictMode>,
      'editor'
    );
    const backgroundClass = () => div.querySelector('.tico-icon-svg')?.classList[1];
    const first = await shouldHappen(backgroundClass);
    expect(div.querySelectorAll(`.${first}`).length).toBe(2);
    await shouldHappen(() => rulesFor(first).length === 1);
    changePath('M0 0L96 0L96 96Z');
    const second = await shouldHappen(() => backgroundClass() !== first && backgroundClass());
    expect(second).not.toBe(first);
    await shouldHappen(() => rulesFor(first).length === 0 && rulesFor(second).length === 1);
    removeLastTemplate();
    await shouldHappen(() => rulesFor(second).length === 0);
  });
});
