import React, {useLayoutEffect, useState} from 'react';
import {Flow, FlowFolder} from '@ticlo/core';
import {
  MarkdownElement,
  MarkdownComponentsContext,
  MarkdownCode,
  MarkdownContent,
  MarkdownHeading,
  parseMarkdown,
  TicloComp,
  type MarkdownCodeProps,
  type MarkdownContentProps,
  type MarkdownHeadingProps,
} from '../../index.ts';
import {creatReactRoot, type ReactRoot} from '../../functions/__spec__/render.ts';

describe('MarkdownElement', () => {
  let root: ReactRoot;
  let flow: Flow;

  beforeEach(() => {
    root = creatReactRoot();
    flow = new Flow();
  });

  afterEach(() => {
    root.remove();
    flow.destroy();
  });

  it('mounts a component for every heading, code block and intervening content run', async () => {
    const mounted: string[] = [];
    function Heading(props: MarkdownHeadingProps) {
      useLayoutEffect(() => {
        mounted.push('heading');
      }, []);
      return <MarkdownHeading {...props} />;
    }
    function Code(props: MarkdownCodeProps) {
      useLayoutEffect(() => {
        mounted.push('code');
      }, []);
      return <MarkdownCode {...props} />;
    }
    function Content(props: MarkdownContentProps) {
      useLayoutEffect(() => {
        mounted.push('content');
      }, []);
      return <MarkdownContent {...props} />;
    }
    const block = flow.createBlock('markdown');
    block.setValue(
      'source',
      [
        'Before.',
        '',
        '# One',
        '',
        'Paragraph one.',
        '',
        'Paragraph two.',
        '',
        '```js',
        '# not a heading',
        '```',
        '',
        '## Two',
        '### Three',
        '',
        '```',
        'plain code',
        '```',
        '',
        'After.',
      ].join('\n')
    );

    await root.waitRender(
      <MarkdownComponentsContext value={{heading: Heading, code: Code, content: Content}}>
        <MarkdownElement block={block} />
      </MarkdownComponentsContext>
    );

    expect(mounted).toEqual(['content', 'heading', 'content', 'code', 'heading', 'heading', 'code', 'content']);
    expect(root.div.querySelectorAll('h1, h2, h3')).toHaveLength(3);
    expect(root.div.querySelector('pre code')?.textContent).toBe('# not a heading');
    expect(root.div.querySelector('code')?.className).toBe('language-js');
    expect(root.div.querySelectorAll('p')).toHaveLength(4);
  });

  it('handles all heading levels, setext headings, longer fences and empty input', () => {
    const source = [
      '# 1',
      '## 2',
      '### 3',
      '#### 4',
      '##### 5',
      '###### 6',
      '',
      'Setext',
      '======',
      '',
      'Subtitle',
      '-------',
      '',
      '````md',
      '```ticlo',
      '## Still code',
      '```',
      '````',
      '',
      '~~~ts',
      'const n = 1;',
      '~~~',
      '',
      '    indented',
    ].join('\r\n');
    const parts = parseMarkdown(source);
    expect(parts.map((part) => part.type)).toEqual([
      'heading',
      'heading',
      'heading',
      'heading',
      'heading',
      'heading',
      'heading',
      'heading',
      'code',
      'code',
      'code',
    ]);
    expect(parts[8]).toMatchObject({type: 'code', token: {text: '```ticlo\n## Still code\n```'}});
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('\n\n')).toEqual([]);
  });

  it('preserves reference links, inline formatting and nested component boundaries', async () => {
    const block = flow.createBlock('markdown');
    block.setValue(
      'source',
      [
        '# [Ticlo][site]',
        '',
        'Read **[the docs][site]** and `inline code`.',
        '',
        '> ## Nested',
        '>',
        '> ```ts',
        '> const x = 1;',
        '> ```',
        '',
        '3. ## Nested',
        '',
        '   ```js',
        '   const y = 2;',
        '   ```',
        '',
        '- [x] Done',
        '',
        '[site]: https://ticlo.org "Ticlo"',
      ].join('\n')
    );

    await root.waitRender(<MarkdownElement block={block} />);

    const links = root.div.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect([...links].map((link) => link.getAttribute('href'))).toEqual(['https://ticlo.org', 'https://ticlo.org']);
    expect(root.div.querySelector('strong a')?.textContent).toBe('the docs');
    expect(root.div.querySelector('blockquote h2')?.id).toBe('nested');
    expect(root.div.querySelector('ol li h2')?.id).toBe('nested-2');
    expect(root.div.querySelector('ol')?.start).toBe(3);
    expect(root.div.querySelectorAll('blockquote pre, li pre')).toHaveLength(2);
    const checkbox = root.div.querySelector('input');
    expect(checkbox?.checked).toBe(true);
    expect(checkbox?.disabled).toBe(true);
  });

  it('renders ordinary prose, lists and quotes in a single content component without extra wrappers', async () => {
    let mounts = 0;
    function Content(props: MarkdownContentProps) {
      useLayoutEffect(() => {
        ++mounts;
      }, []);
      return <MarkdownContent {...props} />;
    }
    const block = flow.createBlock('markdown');
    block.setValue('source', 'Before.\n\n- First\n  - Nested\n- Second\n\n> Quote\n>\n> - Quoted item\n\nAfter.');

    await root.waitRender(
      <MarkdownComponentsContext value={{content: Content}}>
        <MarkdownElement block={block} />
      </MarkdownComponentsContext>
    );

    expect(mounts).toBe(1);
    const article = root.div.firstElementChild;
    expect(article.children).toHaveLength(1);
    const prose = article.firstElementChild;
    expect([...prose.children].map((node) => node.tagName)).toEqual(['P', 'UL', 'BLOCKQUOTE', 'P']);
    expect(prose.querySelector('ul ul li')?.textContent).toBe('Nested');
    expect(prose.querySelector('blockquote li')?.textContent).toBe('Quoted item');
    expect(prose.querySelector('div')).toBeNull();
  });

  it('still mounts custom code components inside nested Markdown containers', async () => {
    function Code({part}: MarkdownCodeProps) {
      return <button>{part.token.text}</button>;
    }
    const block = flow.createBlock('markdown');
    block.setValue('source', '> - Before\n>\n>   ```js\n>   example\n>   ```\n>\n>   After');

    await root.waitRender(
      <MarkdownComponentsContext value={{code: Code}}>
        <MarkdownElement block={block} />
      </MarkdownComponentsContext>
    );

    expect(root.div.querySelector('blockquote > ul > li button')?.textContent).toBe('example');
    expect(root.div.querySelector('blockquote > ul > li')?.textContent).toContain('Before');
    expect(root.div.querySelector('blockquote > ul > li')?.textContent).toContain('After');
  });

  it('updates source on an ordinary Block and supports normal Ticlo registration', async () => {
    const block = flow.createBlock('markdown');
    block.setValue('#is', 'react:markdown');
    block.setValue('class', 'documentation');
    block.setValue('source', '# English');
    await root.waitRender(<TicloComp block={block} />);
    expect(root.div.querySelector('.documentation h1')?.textContent).toBe('English');

    block.setValue('source', '# 中文');
    await root.waitRender();
    expect(root.div.querySelector('h1')?.textContent).toBe('中文');

    block.setValue('source', undefined);
    await root.waitRender();
    expect(root.div.textContent).toBe('');
  });

  it('allows host components with their own state and keeps customization scoped', async () => {
    const block = flow.createBlock('markdown');
    block.setValue('source', '# Before\n\n```counter\ndemo\n```');
    function CustomCode(props: MarkdownCodeProps) {
      const [count, setCount] = useState(0);
      return props.part.token.lang === 'counter' ? (
        <button onClick={() => setCount(count + 1)}>{count}</button>
      ) : (
        <MarkdownCode {...props} />
      );
    }
    await root.waitRender(
      <>
        <MarkdownComponentsContext value={{code: CustomCode}}>
          <MarkdownElement block={block} />
        </MarkdownComponentsContext>
        <MarkdownElement block={block} />
      </>
    );
    const button = root.div.querySelector('button');
    button.click();
    await root.waitRender();
    expect(button.textContent).toBe('1');
    expect(root.div.querySelector('pre code')?.textContent).toBe('demo');

    block.setValue('source', 'Inserted text.\n\n# After\n\n```counter\ndemo\n```');
    await root.waitRender();
    expect(root.div.querySelector('button')).toBe(button);
    expect(button.textContent).toBe('1');
  });

  it('accepts a host-owned FlowFolder and switches Blocks without retaining the old subscription', async () => {
    const folder = new FlowFolder();
    const child = folder.createBlock('child');
    child.setValue('value', 42);
    folder.setValue('source', '# Folder');
    const other = flow.createBlock('other');
    other.setValue('source', '# Other');
    try {
      await root.waitRender(<MarkdownElement block={folder} />);
      expect(root.div.querySelector('h1')?.textContent).toBe('Folder');
      expect(folder.getValue('#is')).toBe('flow:folder');

      await root.waitRender(<MarkdownElement block={other} />);
      folder.setValue('source', '# Old folder changed');
      await root.waitRender();
      expect(root.div.querySelector('h1')?.textContent).toBe('Other');
      await root.waitRender(<></>);
      expect(child.getValue('value')).toBe(42);
      expect(other.getValue('source')).toBe('# Other');
    } finally {
      folder.destroy();
    }
  });

  it('renders safe inline and block HTML while keeping code literal', async () => {
    const block = flow.createBlock('markdown');
    block.setValue(
      'source',
      [
        '# <span style="color:red">Heading</span>',
        '',
        'Text with <strong>HTML</strong> and `<em>inline code</em>`.',
        '',
        '<details><summary>More</summary><p>Details</p></details>',
        '',
        '<img alt="Example" width="20" height="10">',
        '',
        '```html',
        '<em>fenced code</em>',
        '```',
      ].join('\n')
    );
    await root.waitRender(<MarkdownElement block={block} />);
    expect(root.div.querySelector('h1 span')?.textContent).toBe('Heading');
    expect(root.div.querySelector<HTMLSpanElement>('h1 span')?.style.color).toBe('red');
    expect(root.div.querySelector('p strong')?.textContent).toBe('HTML');
    expect(root.div.querySelector('details summary')?.textContent).toBe('More');
    expect(root.div.querySelector('details p')?.textContent).toBe('Details');
    expect(root.div.querySelector('img')?.getAttribute('width')).toBe('20');
    expect(root.div.querySelector('p code')?.textContent).toBe('<em>inline code</em>');
    expect(root.div.querySelector('pre code')?.textContent).toBe('<em>fenced code</em>');
    expect(root.div.querySelector('em')).toBeNull();
  });

  it('removes unsafe HTML, event handlers and URLs from headings and content', async () => {
    const block = flow.createBlock('markdown');
    block.setValue(
      'source',
      [
        '# <img alt="Heading" src="javascript:alert(1)" onerror="alert(1)">',
        '',
        '<script>alert(1)</script>',
        '',
        '<iframe src="https://example.com"></iframe>',
        '',
        '<span onclick="alert(1)">Safe text</span>',
        '',
        '<a href="javascript:alert(1)">HTML link</a>',
        '',
        '[unsafe](javascript:alert%281%29)',
        '',
        '[safe](https://example.com)',
      ].join('\n')
    );
    await root.waitRender(<MarkdownElement block={block} />);
    expect(root.div.querySelector('script, iframe, [onerror], [onclick], img[src]')).toBeNull();
    expect(root.div.querySelector('h1 img')?.getAttribute('alt')).toBe('Heading');
    expect(root.div.querySelector('span')?.textContent).toBe('Safe text');
    expect([...root.div.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
      null,
      null,
      'https://example.com',
    ]);
  });
});
