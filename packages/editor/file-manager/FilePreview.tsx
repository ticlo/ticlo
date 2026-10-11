import React, {useEffect, useMemo, useState} from 'react';
import type {FileEntry, TicloFileClient} from '@ticlo/file-client';
import {Button, Spin} from 'antd';
import CodeMirror from '@uiw/react-codemirror';
import {javascript} from '@codemirror/lang-javascript';
import {markdown} from '@codemirror/lang-markdown';
import {yaml} from '@codemirror/lang-yaml';
import {editorHighlighting, editorTheme} from '../dock/text-editor/TextEditorPane.tsx';
import {t} from '../component/LocalizedLabel.tsx';
import {translateEditor} from '@ticlo/core/editor.ts';
import {fileError} from './FileOperations.ts';

const imageTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};
const textExtensions = new Set(
  (
    'txt text json jsonc json5 js jsx mjs cjs ts tsx mts cts yaml yml md markdown mdx html htm xhtml xml xsd xsl ' +
    'css scss sass less csv tsv log ini conf cfg config properties toml lock env editorconfig gitignore ' +
    'c h cc cpp cxx hpp cs java kt kts scala go rs swift m mm py pyw rb php pl pm lua dart r sh bash zsh fish ' +
    'bat cmd ps1 sql graphql gql vue svelte astro coffee clj cljs ex exs erl hs fs fsx groovy gradle cmake ' +
    'tex bib rst adoc srt vtt diff patch'
  ).split(' ')
);

export function previewType(name: string): 'image' | 'text' | null {
  const lower = name.toLowerCase();
  const ext = lower.split('.').pop();
  if (imageTypes[ext]) return 'image';
  if (textExtensions.has(ext) || /^(readme|license|licence|notice|makefile|dockerfile)$/.test(lower)) return 'text';
  return null;
}

export function formatFileSize(size: number) {
  return size < 1000
    ? `${size} B`
    : size < 1000000
      ? `${(size / 1000).toFixed(1)} kB`
      : `${(size / 1000000).toFixed(1)} MB`;
}

interface Props {
  client: TicloFileClient;
  entry?: FileEntry;
  onDownload: () => void;
}

export function FilePreview({client, entry, onDownload}: Props) {
  const kind = entry?.type === 'file' ? previewType(entry.name) : null;
  const [requested, setRequested] = useState(entry?.type === 'file' && entry.size < 100000 && Boolean(kind));
  const [content, setContent] = useState<string>();
  const [error, setError] = useState<string>();
  const path = entry?.path;
  const name = entry?.name ?? '';
  const extensions = useMemo(() => {
    const ext = name.toLowerCase().split('.').pop();
    if (/^(c|m)?[jt]sx?$|^[cm]ts$/.test(ext))
      return [javascript({jsx: ext.endsWith('x'), typescript: ext.includes('t')})];
    if (/^(json[c5]?|ya?ml)$/.test(ext)) return [yaml()];
    if (/^(md|markdown|mdx)$/.test(ext)) return [markdown()];
    return [];
  }, [name]);

  useEffect(() => {
    if (!requested || !kind) return;
    const controller = new AbortController();
    let url: string;
    client
      .getFile(path, {signal: controller.signal})
      .then((response) => {
        if (controller.signal.aborted) return;
        if (kind === 'image') {
          url = URL.createObjectURL(new Blob([response.data], {type: imageTypes[name.toLowerCase().split('.').pop()]}));
          setContent(url);
        } else {
          const bytes = new Uint8Array(response.data);
          const encoding =
            bytes[0] === 0xff && bytes[1] === 0xfe
              ? 'utf-16le'
              : bytes[0] === 0xfe && bytes[1] === 0xff
                ? 'utf-16be'
                : 'utf-8';
          setContent(new TextDecoder(encoding).decode(bytes));
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(fileError(error));
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [client, requested, kind, path, name]);

  return (
    <div className="ticl-e-file-preview">
      <div className="ticl-e-file-preview-content">
        {!entry ? (
          <div className="ticl-e-file-placeholder">{t('Select a file to preview')}</div>
        ) : entry.type === 'folder' ? (
          <div className="ticl-e-file-placeholder">{t('Folder')}</div>
        ) : !kind ? (
          <div className="ticl-e-file-placeholder">
            {t('Preview unavailable')}
            <Button size="small" onClick={onDownload}>
              {t('Download')}
            </Button>
          </div>
        ) : error ? (
          <div className="ticl-e-file-error">{error}</div>
        ) : !requested ? (
          <div className="ticl-e-file-placeholder">
            <Button size="small" onClick={() => setRequested(true)}>
              {t('Load preview')}
            </Button>
          </div>
        ) : content === undefined ? (
          <div className="ticl-e-file-placeholder">
            <Spin size="small" />
          </div>
        ) : kind === 'image' ? (
          <img src={content} alt={name} onError={() => setError(translateEditor('Unable to preview image'))} />
        ) : (
          <CodeMirror
            className="ticl-e-file-preview-text"
            value={content}
            readOnly={true}
            editable={false}
            height="100%"
            theme={editorTheme}
            extensions={[editorHighlighting, ...extensions]}
            basicSetup={{highlightActiveLine: false, highlightActiveLineGutter: false, autocompletion: false}}
          />
        )}
      </div>
      {entry ? (
        <div className="ticl-e-file-info">
          <div title={entry.name}>
            {t('Name')}: {entry.name}
          </div>
          <div title={entry.path}>
            {t('Path')}: {entry.path}
          </div>
          {entry.type === 'file' ? (
            <div>
              {t('Size')}: {formatFileSize(entry.size)} ({entry.size} B)
            </div>
          ) : null}
          {entry.modified > 0 ? (
            <div>
              {t('Modified')}: {new Date(entry.modified).toLocaleString()}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
