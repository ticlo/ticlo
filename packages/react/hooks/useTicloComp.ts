import {isValidElement, ReactNode, SyntheticEvent, useCallback, useEffect, useState} from 'react';
import {Block, BlockProperty, Event} from '@ticlo/core';
import {PropMap} from '../types/PropType.js';
import {Values} from '../types/Values.js';
import {useBlockConfigs} from './useBlockConfigs.js';
import {useMemoUpdate, useRefState, useValueRef} from '../util/react-tools.js';

const configsMap: PropMap = {
  '#order': {value: Values.arrayOptional, pinned: true},
  '#optional': {value: Values.arrayOptional, pinned: true},
};

function isReactChild(child: unknown): child is ReactNode | Block {
  return child instanceof Block || isValidElement(child) || typeof child === 'string' || typeof child === 'number';
}

export function getChildren(block: Block, overrideChildren?: unknown[], order?: unknown[]): (ReactNode | Block)[] {
  if (overrideChildren === undefined) {
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
    if (order === undefined) {
      order = block.getValue('#order') as unknown[] | [];
    }
    // inline children
    for (const name of order) {
      if (typeof name === 'string') {
        const b = block.getValue(name);
        if (b instanceof Block) {
          result.push(b);
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

function buildOptionalHandlers(block: Block, optionalList: string[]) {
  if (Array.isArray(optionalList)) {
    const result: Record<string, unknown> = {};
    for (const name of optionalList) {
      if (!/^on[A-Z]/.test(name)) {
        // build event handlers
        result[name] = (event: SyntheticEvent) => {
          block.updateValue(name, new ReactEvent(event));
        };
      } else if (name === 'ref') {
        // build ref handler
        result[name] = (value: unknown) => {
          block.updateValue(name, value);
        };
      } else {
        // other values are just passed through
        result[name] = block.getValue(name);
      }
    }
    return result;
  }
  return undefined;
}

export function useTicloComp(block: Block) {
  const [style, setStyle] = useState(undefined);
  const [className, setClassName] = useState(undefined);
  const {'#order': orderList, '#optional': optionalList} = useBlockConfigs(block, configsMap);

  // resolve children from override children or ordered children
  const [children, setChildren, childrenRef] = useRefState(undefined);
  const orderRef = useValueRef(orderList);
  const [resolvedChildren, updateResolvedChildren] = useMemoUpdate(
    () => getChildren(block, children, orderList),
    [block, children, orderList]
  );

  // resolve optional properties
  const optionalRef = useValueRef(optionalList);
  const [optionalHandlers, updateOptionalHandlers] = useMemoUpdate(
    () => buildOptionalHandlers(block, optionalList),
    [block, optionalList]
  );

  const onPropertyChange = useCallback((property: BlockProperty, saved?: boolean) => {
    switch (property._name) {
      case 'children':
        setChildren(property.getValue());
        break;
      case 'style':
        setStyle(property.getValue());
        break;
      case 'class':
        setClassName(property.getValue());
        break;
    }
    if (
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
