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
