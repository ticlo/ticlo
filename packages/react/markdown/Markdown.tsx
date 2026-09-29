import React, {createContext, useContext, useMemo, type ComponentType} from 'react';
import DOMPurify from 'dompurify';
import {type MarkdownPart, renderMarkdownInline, renderMarkdownTokens} from './parseMarkdown.ts';

export type MarkdownHeadingProps = {part: Extract<MarkdownPart, {type: 'heading'}>};
export type MarkdownCodeProps = {part: Extract<MarkdownPart, {type: 'code'}>};
export type MarkdownContentProps = {part: Extract<MarkdownPart, {type: 'content'}>};

/** Hosts can supply ordinary React components; access host-specific state through their own context. */
export const MarkdownComponentsContext = createContext<{
  heading?: ComponentType<MarkdownHeadingProps>;
  code?: ComponentType<MarkdownCodeProps>;
  content?: ComponentType<MarkdownContentProps>;
}>({});

function sanitized(html: string) {
  return {__html: DOMPurify.sanitize(html, {USE_PROFILES: {html: true}})};
}

export function MarkdownHeading({part}: MarkdownHeadingProps) {
  const html = useMemo(() => sanitized(renderMarkdownInline(part.token.tokens)), [part]);
  return React.createElement(`h${part.token.depth}`, {id: part.id, dangerouslySetInnerHTML: html});
}

export function MarkdownCode({part}: MarkdownCodeProps) {
  const language = part.token.lang?.trim().split(/\s+/)[0];
  return (
    <pre>
      <code className={language ? `language-${language}` : undefined}>{part.token.text}</code>
    </pre>
  );
}

export function MarkdownContent({part}: MarkdownContentProps) {
  return useMemo(
    () =>
      part.nodes.map((node, index) => {
        if (node.type === 'tokens') {
          return <div key={index} dangerouslySetInnerHTML={sanitized(renderMarkdownTokens(node.tokens))} />;
        }
        if (node.type === 'blockquote') {
          return (
            <blockquote key={index}>
              <MarkdownParts parts={node.parts} />
            </blockquote>
          );
        }
        const List = node.ordered ? 'ol' : 'ul';
        return (
          <List key={index} start={node.ordered ? Number(node.start) : undefined}>
            {node.items.map((parts, itemIndex) => (
              <li key={itemIndex}>
                <MarkdownParts parts={parts} />
              </li>
            ))}
          </List>
        );
      }),
    [part]
  );
}

/** Each heading, code block and intervening content run has its own React lifecycle. */
export function MarkdownParts({parts}: {parts: MarkdownPart[]}) {
  const {
    heading: Heading = MarkdownHeading,
    code: Code = MarkdownCode,
    content: Content = MarkdownContent,
  } = useContext(MarkdownComponentsContext);
  return parts.map((part) => {
    switch (part.type) {
      case 'heading':
        return <Heading key={part.key} part={part} />;
      case 'code':
        return <Code key={part.key} part={part} />;
      case 'content':
        return <Content key={part.key} part={part} />;
    }
  });
}
