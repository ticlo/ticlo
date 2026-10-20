import {
  isValidElement,
  ReactNode,
  SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import {Block, BlockOrder, BlockProperty, Event, getBlockOrder} from '@ticlo/core';
import {PropMap} from '../comp/PropType.ts';
import {Values} from '../comp/Values.ts';
import {ComponentContext} from '../ComponentContext.ts';
import {useBlockConfigs} from './useBlockConfigs.ts';
import {useComponentRef} from './useComponentRef.ts';
import {useMemoUpdate, useValueRef} from '../util/react-tools.ts';

const configsMap: PropMap = {
  '#order': {value: Values.any, pinned: true},
  '#optional': {value: Values.arrayOptional, pinned: true},
};
const noChildrenConfigsMap: PropMap = {
  '#optional': {value: Values.arrayOptional, pinned: true},
};

function isReactChild(child: unknown): child is ReactNode | Block {
  return child instanceof Block || isValidElement(child) || typeof child === 'string' || typeof child === 'number';
}

export function getChildren(block: Block, order?: unknown, content?: unknown): (ReactNode | Block)[] {
  const result: (ReactNode | Block)[] = [];
  const source = getBlockOrder(block, order);
  const appendContent = (value: unknown) => {
    result.push(...(Array.isArray(value) ? value : [value]).filter(isReactChild));
  };

  // inline children
  if (source) {
    for (const name of source.order) {
      const child = source.getValue(name);
      if (name === 'content') {
        appendContent(source.owner === block ? content : child);
      } else if (child instanceof Block) {
        result.push(child);
      }
    }
  }
  // Only an order owned by this Block can consume its content slot.
  if (source?.owner !== block || !source.order.includes('content')) appendContent(content);

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
  optionalHandler: ((block: Block, name: string) => unknown) | undefined,
  designMode: boolean
) {
  // cache handlers
  const cache = useRef<Record<string, Function>>({});
  return useMemoUpdate(() => {
    const result: Record<string, unknown> = {};
    if (Array.isArray(optionalList)) {
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

        const isEvent = name.startsWith('on');
        if (isEvent) {
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
  }, [block, optionalList, optionalHandler, designMode]);
}

export function useTicloComp(
  block: Block,
  {
    optionalHandler,
    noChildren,
    ref,
  }: {
    optionalHandler?: (block: Block, name: string) => unknown;
    noChildren?: boolean;
    ref?: Ref<Element>;
  } = {}
) {
  const componentContext = useContext(ComponentContext);
  const {designMode, elementMap} = componentContext;
  // put the noChildren option in a ref so it can never change
  const needChildren = useRef(noChildren !== true).current;
  const [style, setStyle] = useState(() => block.getValue('style'));
  const [className, setClassName] = useState(() => block.getValue('class') as string);
  const {'#order': orderList, '#optional': optionalList} = useBlockConfigs(
    block,
    noChildren ? noChildrenConfigsMap : configsMap
  );

  // resolve content from override children or ordered children
  const [content, setContent] = useState(needChildren ? block.getValue('content') : undefined);

  const orderRef = useValueRef(orderList);
  const [resolvedChildren, updateResolvedChildren] = useMemoUpdate(
    () => (needChildren ? getChildren(block, orderList, content) : []),
    [block, orderList, content]
  );

  // resolve optional properties
  const optionalRef = useValueRef(optionalList);
  const [optionalHandlers, updateOptionalHandlers] = useOptionalHandlers(
    block,
    optionalList,
    optionalHandler,
    designMode
  );
  const componentRef = useComponentRef(block, elementMap, ref, optionalHandlers?.ref as Ref<Element> | undefined);
  const handlers = useMemo<Record<string, unknown>>(
    () => ({...optionalHandlers, ref: componentRef}),
    [optionalHandlers, componentRef]
  );

  const onPropertyChange = useCallback(
    (property: BlockProperty, saved?: boolean) => {
      switch (property._name) {
        case 'content':
          if (needChildren) {
            setContent(property.getValue());
          }
          break;
        case 'style':
          setStyle(property.getValue());
          break;
        case 'class':
          setClassName(property.getValue());
          break;
      }
      const order = getBlockOrder(block, orderRef.current);
      if (needChildren && order?.owner === block && order.order.includes(property._name)) {
        updateResolvedChildren();
      } else if (Array.isArray(optionalRef.current) && optionalRef.current.includes(property._name)) {
        updateOptionalHandlers();
      }
    },
    [block, needChildren, orderRef, optionalRef, updateResolvedChildren, updateOptionalHandlers]
  );

  useEffect(() => {
    const listener = {onChildChange: onPropertyChange};
    block.watch(listener);
    return () => {
      block.unwatch(listener);
    };
  }, [block, onPropertyChange]);

  useEffect(() => {
    if (!(orderList instanceof BlockOrder) || !(orderList.owner instanceof Block) || orderList.owner === block) return;
    const owner = orderList.owner;
    const listener = {
      onChildChange(property: BlockProperty) {
        if (orderList.order.includes(property._name)) updateResolvedChildren();
      },
    };
    owner.watch(listener);
    return () => owner.unwatch(listener);
  }, [block, orderList, updateResolvedChildren]);

  return {
    className,
    style,
    children: resolvedChildren,
    optionalHandlers: handlers,
  };
}
