import React, {useMemo, ComponentType} from 'react';
import {Block, DataMap, FunctionDesc, globalFunctions, PropDesc} from '@ticlo/core';
import {useTicloComp} from '../hooks/useTicloComp.js';
import {registerComponent, renderChildren} from '../comp/Component.js';
import {elementClassProperty, elementConfigs, elementStyleProperty} from '../comp/CommontProps.js';
import {useBlockConfigs} from '../hooks/useBlockConfigs.js';
import {Values} from '../comp/Values.js';
import {useBlockPropertyValue} from '../hooks/useBlockPropertyValue.js';

const PRECODE = `
const {block, React} = props;
const {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef
} = React;`;

function parseJsx(script: string): ComponentType<{block: Block; React: any}> {
  if (!script || typeof script !== 'string') {
    return null;
  }
  try {
    const Babel = (window as any).Babel;

    if (Babel) {
      const toTransform = `"use strict";const props={};${PRECODE}function _F_(){${script}}`;
      const code = Babel.transform(toTransform, {presets: ['es2017', 'react']}).code;
      script = code.substring(33).replace('function _F_() ', '');
    }
    return new Function('props', script) as ComponentType<{block: Block; React: any}>;
  } catch (err) {
    return () => String(err);
  }
}

function JsxComponent({block}: {block: Block}) {
  const script = useBlockPropertyValue<string>(block, 'script');

  const ParsedCompnent = useMemo(() => parseJsx(script), [script]);
  if (ParsedCompnent) {
    return <ParsedCompnent block={block} React={React} />;
  }
  return null;
}
const jsxComponentDesc: FunctionDesc = {
  name: 'jsx',
  base: 'react:element',
  properties: [
    {
      name: 'script',
      type: 'string',
      mime: 'text/jsx',
      pinned: true,
    },
    elementStyleProperty,
    elementClassProperty,
  ],
  category: 'react:elements',
};
registerComponent(JsxComponent, 'jsx', null, jsxComponentDesc, 'react');
