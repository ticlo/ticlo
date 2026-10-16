import React, {isValidElement, useContext, useLayoutEffect, useMemo, useState, type ReactNode} from 'react';
import {Block} from '@ticlo/core';
import {ComponentContext, type ComponentContextValue} from '../ComponentContext.ts';
import {useBlockValue} from '../hooks/useBlockValue.ts';
import {ElementMap} from '../util/ElementMap.ts';
import {TicloComp, type BaseProps} from './Component.tsx';

export interface TicloPageProps extends BaseProps {
  context?: ComponentContextValue<Block | string>;
  fallback?: ReactNode;
}

/** Render #main in its own context and expose its root elements to the parent context. */
export function TicloPage<T extends TicloPageProps = TicloPageProps>({block, context, fallback = null, ...others}: T) {
  const main = useBlockValue(block, '#main');
  const parentMap = useContext(ComponentContext).elementMap;
  const [localMap] = useState(() => new ElementMap());
  const elementMap = context?.elementMap ?? localMap;
  const value = useMemo<ComponentContextValue<Block | string>>(
    () => ({
      designMode: false,
      select: () => false,
      addSelection: () => false,
      ...context,
      elementMap,
    }),
    [context, elementMap]
  );

  useLayoutEffect(() => {
    if (!(main instanceof Block) || !parentMap || parentMap === elementMap) return;
    const roots = new Map<Element, () => void>();
    const syncRoots = () => {
      const elements = new Set(elementMap.getElements(main));
      for (const [element, disconnect] of roots) {
        if (!elements.has(element)) {
          roots.delete(element);
          disconnect();
        }
      }
      for (const element of elements) {
        if (!roots.has(element)) roots.set(element, parentMap.connect(block, element));
      }
    };
    const unsubscribe = elementMap.subscribe((changed) => {
      if (changed === main) syncRoots();
    });
    // Child refs can attach before this Page's layout effect runs.
    syncRoots();
    return () => {
      unsubscribe();
      for (const disconnect of roots.values()) disconnect();
    };
  }, [block, main, elementMap, parentMap]);

  let page = fallback;
  if (main instanceof Block) {
    page = <TicloComp {...others} block={main} key={main._blockId} />;
  } else if (isValidElement(main)) {
    page = main;
  }
  return <ComponentContext.Provider value={value}>{page}</ComponentContext.Provider>;
}
