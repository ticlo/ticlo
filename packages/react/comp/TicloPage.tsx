import React, {isValidElement, useContext, useMemo, type ReactNode} from 'react';
import {Block} from '@ticlo/core';
import {
  ComponentContext,
  ComponentRenderContext,
  defaultComponentContext,
  type ComponentContextValue,
} from '../ComponentContext.ts';
import {useBlockValue} from '../hooks/useBlockValue.ts';
import {TicloComp, type BaseProps} from './Component.tsx';

export interface TicloPageProps extends BaseProps {
  context?: ComponentContextValue<Block | string>;
  fallback?: ReactNode;
}

/** Render #main while retaining the editable flow and its root DOM ownership. */
export function TicloPage<T extends TicloPageProps = TicloPageProps>({block, context, fallback = null, ...others}: T) {
  const main = useBlockValue(block, '#main');
  const parentContext = useContext(ComponentContext);
  const parent = useContext(ComponentRenderContext);
  const flow = context ? block._flow : (parent?.flow ?? block._flow);
  const rootContext = context ?? parent?.context ?? parentContext;
  const owner = context
    ? undefined
    : block === parent?.main && parent.owner
      ? parent.owner
      : block._flow === flow
        ? block
        : undefined;
  const value = useMemo(
    () => ({flow, context: rootContext, main: main instanceof Block ? main : undefined, owner}),
    [flow, rootContext, main, owner]
  );

  let page = fallback;
  if (main instanceof Block) {
    page = <TicloComp {...others} block={main} key={main._blockId} />;
  } else if (isValidElement(main)) {
    page = main;
  }
  return (
    <ComponentRenderContext.Provider value={value}>
      <ComponentContext.Provider value={context ?? defaultComponentContext}>{page}</ComponentContext.Provider>
    </ComponentRenderContext.Provider>
  );
}
