import {Marked, type Token, type Tokens} from 'marked';

// Keep options local to this renderer; editor Markdown uses its own configuration.
const markdown = new Marked();

export type MarkdownContentNode =
  | {type: 'tokens'; tokens: Token[]}
  | {type: 'blockquote'; parts: MarkdownPart[]}
  | {type: 'list'; ordered: boolean; start: number | ''; items: MarkdownPart[][]};

export type MarkdownPart = {key: string} & (
  | {type: 'heading'; token: Tokens.Heading; id: string}
  | {type: 'code'; token: Tokens.Code}
  | {type: 'content'; nodes: MarkdownContentNode[]}
);

function needsComponents(token: Token): boolean {
  switch (token.type) {
    case 'heading':
    case 'code':
      return true;
    case 'blockquote':
      return token.tokens.some(needsComponents);
    case 'list':
      return (token as Tokens.List).items.some((item) => item.tokens.some(needsComponents));
    default:
      return false;
  }
}

/** Parse once so reference links can resolve across component boundaries. No Block or DOM is required. */
export function parseMarkdown(source: string): MarkdownPart[] {
  const headings = new Set<string>();

  function split(tokens: Token[]): MarkdownPart[] {
    const parts: MarkdownPart[] = [];
    const keys = new Map<string, number>();
    let pending: Token[] = [];

    function key(type: string, raw: string) {
      const base = `${type}:${raw.trim()}`;
      const count = keys.get(base) ?? 0;
      keys.set(base, count + 1);
      return `${base}:${count}`;
    }

    function flush() {
      if (!pending.some((token) => token.type !== 'space' && token.type !== 'def')) {
        pending = [];
        return;
      }
      const nodes: MarkdownContentNode[] = [];
      let run: Token[] = [];
      function flushRun() {
        if (run.some((token) => token.type !== 'space' && token.type !== 'def')) {
          nodes.push({type: 'tokens', tokens: run});
        }
        run = [];
      }
      for (const token of pending) {
        if (token.type === 'blockquote' && needsComponents(token)) {
          flushRun();
          nodes.push({type: 'blockquote', parts: split(token.tokens)});
        } else if (token.type === 'list' && needsComponents(token)) {
          flushRun();
          const list = token as Tokens.List;
          nodes.push({
            type: 'list',
            ordered: list.ordered,
            start: list.start,
            items: list.items.map((item) => split(item.tokens)),
          });
        } else {
          run.push(token);
        }
      }
      flushRun();
      parts.push({type: 'content', key: key('content', ''), nodes});
      pending = [];
    }

    for (const token of tokens) {
      if (token.type === 'heading') {
        flush();
        const heading = token as Tokens.Heading;
        const base =
          heading.text
            .toLowerCase()
            .replace(/[^\p{L}\p{N}_\s-]/gu, '')
            .trim()
            .replace(/\s+/g, '-') || 'heading';
        let id = base;
        for (let suffix = 2; headings.has(id); ++suffix) {
          id = `${base}-${suffix}`;
        }
        headings.add(id);
        parts.push({type: 'heading', key: key('heading', token.raw), token: heading, id});
      } else if (token.type === 'code') {
        flush();
        parts.push({type: 'code', key: key('code', token.raw), token: token as Tokens.Code});
      } else {
        pending.push(token);
      }
    }
    flush();
    return parts;
  }

  return split(markdown.lexer(source));
}

export function renderMarkdownTokens(tokens: Token[]): string {
  return new markdown.Parser(markdown.defaults).parse(tokens);
}

export function renderMarkdownInline(tokens: Token[]): string {
  return new markdown.Parser(markdown.defaults).parseInline(tokens);
}
