import {ReactNode, useEffect, useReducer, useRef, useState} from 'react';
import {Block, BlockIO} from '@ticlo/core';
import {BlockChildWatch} from '@ticlo/core/block/Block';

/**
 * Get the list of children blocks from #children config
 * @param block
 */
export function useChildren(block: Block): Block[] {
  const [, forceUpdate] = useReducer((x) => -x, 1);
  const [childrenNames, setChildrenNames] = useState<string[]>([]);
  useEffect(() => {
    const listener = {
      onChange: (value: unknown) => {
        if (Array.isArray(value)) {
          setChildrenNames(value);
        } else {
          setChildrenNames([]);
        }
      },
      onSourceChange: () => {},
    };
    const childrenProp = block.getProperty('#children', true);
    childrenProp.listen(listener);
    return () => {
      childrenProp.unlisten(listener);
    };
  }, [block]);
  useEffect(() => {
    const listener = {
      onChildChange: (property) => {
        if (childrenNames.includes(property._name)) {
          forceUpdate();
        }
      },
    } as BlockChildWatch;
    block.watch(listener);
    return () => {
      block.unwatch(listener);
    };
  }, [block]);
  let result: Block[] = [];
  for (const name of childrenNames) {
    const b = block.getValue(name);
    if (b instanceof Block) {
      result.push(b);
    }
  }
  return result;
}
