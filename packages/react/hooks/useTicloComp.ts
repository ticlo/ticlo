import {isValidElement, ReactNode, SyntheticEvent, useCallback, useEffect, useRef, useState} from 'react';
import {Block, BlockProperty, Event} from '@ticlo/core';
import {PropMap} from '../comp/PropType.js';
import {Values} from '../comp/Values.js';
import {useBlockConfigs} from './useBlockConfigs.js';
import {useMemoUpdate, useRefState, useValueRef} from '../util/react-tools.js';

const configsMap: PropMap = {
  '#order': {value: Values.arrayOptional, pinned: true},
  '#optional': {value: Values.arrayOptional, pinned: true},
};
const noChildrenConfigsMap: PropMap = {
  '#optional': {value: Values.arrayOptional, pinned: true},
};

function isReactChild(child: unknown): child is ReactNode | Block {
  return child instanceof Block || isValidElement(child) || typeof child === 'string' || typeof child === 'number';
}

export function getChildren(block: Block, overrideChildren?: unknown, order?: unknown): (ReactNode | Block)[] {
  if (!Array.isArray(overrideChildren)) {
    overrideChildren = block.getValue('children') as unknown[];
  }
  const result: (ReactNode | Block)[] = [];
  if (Array.isArray(overrideChildren)) {
    // overrideChildren children with an array of blocks
    for (const child of overrideChildren) {
      if (isReactChild(child)) {
        result.push(child);
      }
    }
  } else {
    if (!Array.isArray(order)) {
      order = block.getValue('#order') as unknown[];
    }
    // inline children
    if (Array.isArray(order)) {
      for (const name of order) {
        if (typeof name === 'string') {
          const b = block.getValue(name);
          if (b instanceof Block) {
            result.push(b);
          }
        }
      }
    }
  }
  return result;
}

class ReactEvent extends Event<SyntheticEvent> {
  constructor(event: SyntheticEvent) {
    super(event.type || 'react', event);
  }
}

function useOptionalHandlers(
  block: Block,
  optionalList: string[],
  optionalHandler?: (block: Block, name: string) => unknown
) {
  // cache handlers
  const cache = useRef<Record<string, Function>>({});
  return useMemoUpdate(() => {
    if (Array.isArray(optionalList)) {
      const result: Record<string, unknown> = {};
      for (const name of optionalList) {
        if (cache.current[name]) {
          result[name] = cache.current[name];
          continue;
        }

        if (optionalHandler) {
          const handlerResult = optionalHandler(block, name);
          if (handlerResult !== undefined) {
            if (typeof handlerResult === 'function') {
              cache.current[name] = handlerResult;
              result[name] = cache.current[name];
            } else {
              result[name] = handlerResult;
            }
            continue;
          }
        }

        if (!/^on[A-Z]/.test(name)) {
          // build event handlers
          cache.current[name] = (event: SyntheticEvent) => {
            block.updateValue(name, new ReactEvent(event));
          };
          result[name] = cache.current[name];
        } else if (name === 'ref') {
          cache.current[name] = (value: unknown) => {
            block.updateValue(name, value);
          };
          result[name] = cache.current[name];
        } else {
          result[name] = block.getValue(name);
        }
      }
      return result;
    }
    return undefined;
  }, [block, optionalList, optionalHandler]);
}

export function useTicloComp(
  block: Block,
  {optionalHandler, noChildren}: {optionalHandler?: (block: Block, name: string) => unknown; noChildren?: boolean} = {}
) {
  // put the noChildren option in a ref so it can never change
  const needChildren = useRef(noChildren !== true).current;
  const [style, setStyle] = useState(() => block.getValue('style'));
  const [className, setClassName] = useState(() => block.getValue('class') as string);
  const {'#order': orderList, '#optional': optionalList} = useBlockConfigs(
    block,
    noChildren ? noChildrenConfigsMap : configsMap
  );

  // resolve children from override children or ordered children
  const [children, setChildren, childrenRef] = useRefState(() =>
    needChildren ? block.getValue('children') : undefined
  );
  const orderRef = useValueRef(orderList);
  const [resolvedChildren, updateResolvedChildren] = useMemoUpdate(
    () => (needChildren ? getChildren(block, children, orderList) : []),
    [block, children, orderList]
  );

  // resolve optional properties
  const optionalRef = useValueRef(optionalList);
  const [optionalHandlers, updateOptionalHandlers] = useOptionalHandlers(block, optionalList, optionalHandler);

  const onPropertyChange = useCallback((property: BlockProperty, saved?: boolean) => {
    switch (property._name) {
      case 'children':
        if (needChildren) {
          setChildren(property.getValue());
        }
        break;
      case 'style':
        setStyle(property.getValue());
        break;
      case 'class':
        setClassName(property.getValue());
        break;
    }
    if (
      needChildren &&
      childrenRef.current !== undefined && // when children are set, there is no need to check orderList
      Array.isArray(orderRef.current) &&
      orderRef.current.includes(property._name)
    ) {
      updateResolvedChildren();
    } else if (Array.isArray(optionalRef.current) && optionalRef.current.includes(property._name)) {
      updateOptionalHandlers();
    }
  }, []);

  useEffect(() => {
    const listener = {onChildChange: onPropertyChange};
    block.watch(listener);
    return () => {
      block.unwatch(listener);
    };
  }, [block]);

  return {
    className,
    style,
    children: resolvedChildren,
    optionalHandlers,
  };
}
