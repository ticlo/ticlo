import React, {useContext, useEffect, useMemo, useState} from 'react';
import {
  Block,
  Flow,
  FlowInputsBlock,
  FlowOutputsBlock,
  FlowPropsSync,
  Root,
  classifyFilePath,
  globalFunctions,
  tryParseFilePath,
  type FlowRef,
} from '@ticlo/core';
import {Library} from '@ticlo/core/block/Library.ts';
import {validFlowEntry} from '@ticlo/core/util/FlowStoragePath.ts';
import {libraryPrefix} from '@ticlo/core/util/LibraryMetadata.ts';
import {ComponentContext} from '../ComponentContext.ts';
import {useBlockConfigs} from '../hooks/useBlockConfigs.ts';
import {useBlockValue} from '../hooks/useBlockValue.ts';
import {useTicloComp} from '../hooks/useTicloComp.ts';
import {useValue} from '../hooks/useValue.ts';
import {optionalHtmlSuggestions} from '../elements/HtmlAttributes.ts';
import {elementAttributes, elementClassProperty, elementStyleProperty} from './CommontProps.ts';
import {metaKey} from './Component.tsx';
import {TicloPage} from './TicloPage.tsx';
import {Values} from './Values.ts';
import {enterPageFlow, leavePageFlow, type PageCloseMode} from './PageFlow.ts';

const PAGE_INCLUDE_RESERVED = new Set(['src', '#closeMode', 'style', 'class', '#props']);

const pageIncludeOptions = {
  noChildren: true,
};

const pageIncludePropMap = {
  src: {value: Values.string},
};

function normalizeCloseMode(value: unknown): PageCloseMode {
  return value === 'on' || value === 'disable' ? value : 'off';
}

export function resolvePageIncludeTarget(src: unknown, library?: string): {ref: FlowRef; path: string} | null {
  if (typeof src !== 'string') return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  const kind = classifyFilePath(trimmed);
  if (kind === 'url' || kind === 'external' || kind === 'frontend') return null;
  const candidate = kind ? trimmed : `+/${trimmed}`;
  const parsed = tryParseFilePath(candidate, library);
  if (!parsed || parsed.kind !== 'project' || !parsed.relativePath.endsWith('.ticlo')) return null;
  const parts = parsed.relativePath.slice(0, -6).split('/');
  if (!parts.every(validFlowEntry)) return null;
  const name = parts.join('.');
  return {
    ref: {library: parsed.project, kind: 'flow', name},
    path: `${libraryPrefix(parsed.project)}${name}`,
  };
}

interface LeaseState {
  path: string;
  flow: Flow | null;
  status: 'loading' | 'ready' | 'limit' | 'error';
  error?: string;
}

export function PageInclude({block}: {block: Block}) {
  const {designMode} = useContext(ComponentContext);
  const {style, className, optionalHandlers} = useTicloComp(block, pageIncludeOptions);
  const {src} = useBlockConfigs(block, pageIncludePropMap);
  const flow = block._flow;
  const library = flow?._library;
  const root = flow ? Library.rootOf(flow) : Root.instance;
  const target = useMemo(() => resolvePageIncludeTarget(src, library), [src, library]);

  const [leaseState, setLeaseState] = useState<LeaseState | null>(null);

  useEffect(() => {
    if (!target) {
      setLeaseState(null);
      return;
    }
    const token = {};
    let active = true;
    setLeaseState({path: target.path, flow: null, status: 'loading'});
    void enterPageFlow(root, target.ref, 'include', token).then(
      (loaded) => {
        if (active) {
          setLeaseState({
            path: target.path,
            flow: loaded,
            status: loaded ? 'ready' : 'limit',
          });
        }
      },
      (error) => {
        if (active) {
          setLeaseState({
            path: target.path,
            flow: null,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    );
    return () => {
      active = false;
      const mode = normalizeCloseMode(block._props.get('#closeMode')?._value);
      leavePageFlow(root, target.ref, 'include', token, mode);
    };
  }, [block, root, target]);

  const liveValue = useValue(root, target?.path);
  const loadedFlow = target && leaseState?.path === target.path ? leaseState.flow : null;
  const activeFlow = loadedFlow && !loadedFlow._destroyed && liveValue === loadedFlow ? loadedFlow : null;
  const bridgeFlow = activeFlow && activeFlow !== flow ? activeFlow : null;
  const inputs = useBlockValue(bridgeFlow, '#inputs');
  const outputs = useBlockValue(bridgeFlow, '#outputs');
  const inputsBlock = inputs instanceof FlowInputsBlock ? inputs : undefined;
  const outputsBlock = outputs instanceof FlowOutputsBlock ? outputs : undefined;

  useEffect(() => {
    if (!bridgeFlow) return;
    const sync = new FlowPropsSync(block, PAGE_INCLUDE_RESERVED);
    sync.setFlow(bridgeFlow);
    return () => sync.destroy();
  }, [block, bridgeFlow]);

  useEffect(() => {
    if (!inputsBlock) return;
    inputsBlock.attachInputHost(block, PAGE_INCLUDE_RESERVED);
    return () => inputsBlock.detachInputHost(block);
  }, [block, inputsBlock]);

  useEffect(() => {
    if (!outputsBlock) return;
    outputsBlock.attachOutputTarget(block, PAGE_INCLUDE_RESERVED);
    return () => outputsBlock.detachOutputTarget(block);
  }, [block, outputsBlock]);

  let content: React.ReactNode = null;
  if (!target) {
    if (designMode) {
      content = (
        <div className="ticl-page-include-empty">
          {typeof src === 'string' && src.trim() ? 'Invalid page src' : 'No page src'}
        </div>
      );
    }
  } else if (activeFlow) {
    content = (
      <TicloPage
        block={activeFlow}
        key={activeFlow._blockId}
        fallback={designMode ? <div className="ticl-page-include-empty">Empty page</div> : null}
      />
    );
  } else if (designMode && leaseState?.path === target.path) {
    if (leaseState.status === 'limit') {
      content = <div className="ticl-page-include-empty">Max page instances reached</div>;
    } else if (leaseState.status === 'error') {
      content = <div className="ticl-page-include-empty">{leaseState.error}</div>;
    }
  }

  return (
    <div
      className={className ? `ticl-page-include ${className}` : 'ticl-page-include'}
      style={style}
      {...optionalHandlers}
    >
      {content}
    </div>
  );
}

globalFunctions.addFactory(
  null,
  {
    name: 'page-include',
    icon: '14^:[ ]',
    base: 'react:element',
    optionalSuggestions: optionalHtmlSuggestions,
    attributes: elementAttributes,
    tags: ['react-comp'],
    dynamicProps: true,
    properties: [
      {name: 'src', type: 'file-path'},
      {
        name: '#closeMode',
        type: 'radio-button',
        options: ['on', 'off', 'disable'],
        default: 'off',
      },
      elementStyleProperty,
      elementClassProperty,
    ],
    init: {style: {width: 200, height: 200}},
  },
  'react',
  undefined,
  {meta: {[metaKey]: PageInclude}}
);
