import {useEffect, useMemo, useReducer, useRef} from 'react';
import {Block, BlockProperty, FunctionInput} from '@ticlo/core';
import {PropMap} from '../types/PropType.js';

/**
 * Get an object with all the properties
 * Doesn't work with configs starts with # and +
 * @param block
 * @param propMap - properties to listen to
 */
export function useBlockProps<T extends PropMap>(
  block: Block,
  propMap: T
): {[K in keyof T]: ReturnType<T[K]['value']['convert']>} {
  // keep track of changes
  const [tic, updateTic] = useReducer((x) => (x + 1) & 0xffff, 1);

  const fieldsRef = useRef<string[]>();
  fieldsRef.current = useMemo(() => Object.keys(propMap).map((key) => propMap[key].name || key), [propMap]);

  useEffect(() => {
    const listener = {
      onChildChange(property: BlockProperty) {
        if (fieldsRef.current.includes(property._name)) {
          updateTic();
        }
      },
    };
    block.watch(listener);
    return () => {
      block.unwatch(listener);
    };
  }, [block]);
  const result: Record<string, unknown> = useMemo(() => {
    const result: Record<string, unknown> = {};
    if (block) {
      for (const field in propMap) {
        const map = propMap[field];
        const fromField = map.name || field;
        result[field] = map.value.convert(block.getValue(fromField), block, map);
      }
    }
    return result;
  }, [block, propMap, tic]);

  return result as {[K in keyof T]: ReturnType<T[K]['value']['convert']>};
}
