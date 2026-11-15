import React from 'react';
import {Flow, MemoryFlowStorage, Root, globalFunctions, shouldHappen} from '@ticlo/core';
import {TicloComp} from '../../comp/Component.tsx';
import {creatReactRoot, type ReactRoot} from '../../functions/__spec__/render.ts';
import '../../index.ts';

describe('react img element', function () {
  let root: ReactRoot;

  beforeEach(function () {
    root = creatReactRoot();
  });

  afterEach(function () {
    root.remove();
  });

  it('renders as a void element without children', async function () {
    const flow = new Flow();
    const block = flow.createBlock('image');
    block.setValue('#is', 'react:img');
    block.setValue('src', 'image.png');

    await root.waitRender(<TicloComp block={block} />);

    const image = root.div.firstElementChild as HTMLImageElement;
    expect(image).toBeInstanceOf(HTMLImageElement);
    expect(image.getAttribute('src')).toBe('image.png');
  });

  it('exposes file-path descriptor and resolves sync and async storage URLs for img and input', async function () {
    expect(globalFunctions.getDesc('react:img').properties?.find((p) => p.name === 'src')?.type).toBe('file-path');
    expect(globalFunctions.getDesc('react:input').optional?.src?.type).toBe('file-path');

    const ticloRoot = new Root();
    class ResolvingStorage extends MemoryFlowStorage {
      resolveFilePath(path: string, library?: string) {
        if (path === '+/sync.png') {
          return `https://cdn.test/${library?.slice(1) || '#root'}/sync.png`;
        }
        if (path === '+/async.png') {
          return Promise.resolve(`blob:https://app.test/${library?.slice(1) || '#root'}/async.png`);
        }
        return undefined;
      }
    }
    await ticloRoot.setStorage(new ResolvingStorage());
    const flow = ticloRoot.addFlow('+proj1.view', undefined, undefined, true);
    const imgBlock = flow.createBlock('image');
    imgBlock.setValue('#is', 'react:img');
    imgBlock.setValue('src', '+/sync.png');

    try {
      await root.waitRender(<TicloComp block={imgBlock} />);
      let image = root.div.firstElementChild as HTMLImageElement;
      expect(image.getAttribute('src')).toBe('https://cdn.test/proj1/sync.png');

      imgBlock.setValue('src', '+/async.png');
      await shouldHappen(
        () =>
          (root.div.firstElementChild as HTMLImageElement)?.getAttribute('src') ===
          'blob:https://app.test/proj1/async.png'
      );

      const inputBlock = flow.createBlock('input');
      inputBlock.setValue('#is', 'react:input');
      inputBlock.setValue('#optional', ['src']);
      inputBlock.setValue('type', 'image');
      inputBlock.setValue('src', '+/sync.png');
      await root.waitRender(<TicloComp block={inputBlock} />);
      const input = root.div.firstElementChild as HTMLInputElement;
      expect(input.getAttribute('src')).toBe('https://cdn.test/proj1/sync.png');
    } finally {
      ticloRoot.destroy();
    }
  });
});
