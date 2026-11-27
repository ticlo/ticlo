import {describe, expect, it} from 'vitest';
import {Flow, MemoryFlowStorage, Root, globalFunctions, shouldHappen} from '../../../index.ts';
import {applyUrlHost} from '../ToUrl.ts';

describe('file:toUrl', () => {
  it('registers file:toUrl with file-path, host, css and output descriptors', () => {
    const desc = globalFunctions.getDesc('file:toUrl');
    expect(desc).toBeTruthy();
    expect(desc.properties).toEqual([
      {name: 'path', type: 'file-path', pinned: true},
      {name: 'host', type: 'string'},
      {name: 'css', type: 'toggle', default: false},
      {name: '#output', type: 'string', readonly: true, pinned: true},
    ]);
  });

  it('converts url and external paths, replaces host, and wraps css url()', () => {
    const flow = new Flow();
    try {
      const block = flow.createBlock('toUrl');
      block.setValue('#is', 'file:toUrl');

      block.setValue('path', 'https://old.example.com/images/pic.png?v=1#top');
      Root.run();
      expect(block.getValue('#output')).toBe('https://old.example.com/images/pic.png?v=1#top');

      block.setValue('host', 'cdn.example.com:8443');
      Root.run();
      expect(block.getValue('#output')).toBe('https://cdn.example.com:8443/images/pic.png?v=1#top');

      block.setValue('host', 'http://localhost:8010/');
      Root.run();
      expect(block.getValue('#output')).toBe('http://localhost:8010/images/pic.png?v=1#top');

      block.setValue('css', true);
      Root.run();
      expect(block.getValue('#output')).toBe("url('http://localhost:8010/images/pic.png?v=1#top')");

      block.setValue('host', undefined);
      block.setValue('path', "/assets/it's.png");
      Root.run();
      expect(block.getValue('#output')).toBe("url('/assets/it\\'s.png')");

      block.setValue('host', 'https://cdn.example.com');
      Root.run();
      expect(block.getValue('#output')).toBe("url('https://cdn.example.com/assets/it\\'s.png')");

      block.setValue('path', './img/logo.png');
      block.setValue('css', false);
      Root.run();
      expect(block.getValue('#output')).toBe('https://cdn.example.com/img/logo.png');

      // Project paths without a resolving storage output undefined (even with css enabled).
      block.setValue('css', true);
      block.setValue('path', '+/local.png');
      Root.run();
      expect(block.getValue('#output')).toBeUndefined();
    } finally {
      flow.destroy();
    }
  });

  it('resolves sync and async storage URLs and ignores stale async resolutions', async () => {
    let resolveDelayed!: (value: string | undefined) => void;
    class TestUrlStorage extends MemoryFlowStorage {
      resolveFileUrl(path: string, library?: string) {
        if (path === '+/sync.png') {
          return `http://127.0.0.1:8010/file/proj/${library?.slice(1) || '#root'}/sync.png`;
        }
        if (path === '+/delayed.png') {
          return new Promise<string | undefined>((resolve) => {
            resolveDelayed = resolve;
          });
        }
        if (path.startsWith('https://')) {
          return path;
        }
        return undefined;
      }
    }

    const root = new Root();
    await root.setStorage(new TestUrlStorage());
    await root.start();
    try {
      const flow = root.addFlow('+proj1.main', undefined, undefined, true);
      const block = flow.createBlock('toUrl');
      block.setValue('#is', 'file:toUrl');
      block.setValue('path', '+/sync.png');
      block.setValue('host', 'https://public.example.com');
      root._run();
      expect(block.getValue('#output')).toBe('https://public.example.com/file/proj/proj1/sync.png');

      block.setValue('path', '+/delayed.png');
      root._run();
      // While the async resolution is pending, switch immediately to a sync path.
      block.setValue('path', 'https://cdn.example.com/immediate.png');
      root._run();
      expect(block.getValue('#output')).toBe('https://public.example.com/immediate.png');

      // Resolving the earlier async call must not overwrite the newer output.
      resolveDelayed('blob:https://app.test/stale');
      await Promise.resolve();
      expect(block.getValue('#output')).toBe('https://public.example.com/immediate.png');

      block.setValue('host', undefined);
      block.setValue('css', true);
      block.setValue('path', '+/delayed.png');
      root._run();
      resolveDelayed('blob:https://app.test/123');
      await shouldHappen(() => block.getValue('#output') === "url('blob:https://app.test/123')");
    } finally {
      root.destroy();
    }
  });

  it('preserves blob/data URLs and protocol-relative URLs during host replacement', () => {
    expect(applyUrlHost('blob:https://app.test/abc', 'https://cdn.example.com')).toBe('blob:https://app.test/abc');
    expect(applyUrlHost('data:image/png;base64,AAA', 'https://cdn.example.com')).toBe('data:image/png;base64,AAA');
    expect(applyUrlHost('//old.example.com/a.png?x=1', 'cdn.example.com')).toBe('//cdn.example.com/a.png?x=1');
    expect(applyUrlHost('//old.example.com/a.png?x=1', 'https://cdn.example.com')).toBe(
      'https://cdn.example.com/a.png?x=1'
    );
  });
});
