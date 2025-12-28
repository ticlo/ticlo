import {ReactNode, useEffect, useReducer, useRef, useState, isValidElement} from 'react';
import {Block, BlockIO, smartStrCompare} from '@ticlo/core';
import {BlockChildWatch} from '@ticlo/core/block/Block.js';
import {Values} from '../types/Values.js';
import {useBlockProps} from './useBlockProps.js';

const groupPropMap = {
  '#order': {value: Values.array, pinned: true},
  'children': {value: Values.arrayOptional, pinned: true},
};

function isReactChild(child: unknown): child is ReactNode | Block {
  return child instanceof Block || isValidElement(child) || typeof child === 'string' || typeof child === 'number';
}

export function getChildren(block: Block, overrideChildren?: unknown[], children?: unknown[]): (ReactNode | Block)[] {
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
    if (children === undefined) {
      children = block.getValue('#order') as unknown[] | [];
    }
    // inline children
    for (const name of children) {
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

/**
 * Get the list of children blocks from #order config
 * @param block
 */
export function useChildren(block: Block): (ReactNode | Block)[] {
  const [, forceUpdate] = useReducer((x) => -x, 1);
  const {'#order': children, 'children': overrideChildren} = useBlockProps(block, groupPropMap);
  useEffect(() => {
    if (Array.isArray(overrideChildren)) {
      // overrideChildren mode
    } else {
      // inline children
      const listener = {
        onChildChange: (property) => {
          if (children.includes(property._name)) {
            forceUpdate();
          }
        },
      } as BlockChildWatch;
      block.watch(listener);
      return () => {
        block.unwatch(listener);
      };
    }
  }, [block, overrideChildren, children]);

  return getChildren(block, overrideChildren, children);
}
