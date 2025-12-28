import {useEffect, useMemo, useReducer} from 'react';
import {Block, BlockProperty, FunctionInput} from '@ticlo/core';
import {PropMap} from '../types/PropType.js';

/**
 * Get an object with properties/configs, more efficiently by listening to each property individually
 * Use useBlockProps when there are many properties but no configs
 * @param block
 * @param propMap - properties to listen to
 */
export function useBlockConfigs<T extends PropMap>(
  block: Block,
  propMap: T
): {[K in keyof T]: ReturnType<T[K]['value']['convert']>} {
  const [tic, updateTic] = useReducer((x) => (x + 1) & 0xffff, 1);

  const fields = useMemo(() => Object.keys(propMap), [propMap]);

  useEffect(() => {
    const listener = {onChange: updateTic, onSourceChange: () => {}};
    // listen to each property
    const props: BlockProperty[] = [];
    if (block instanceof Block) {
      for (const field of fields) {
        const property = block.getProperty(field, true);
        props.push(property);
        property.listen(listener);
      }
    }
    return () => {
      for (const property of props) {
        property.unlisten(listener);
      }
    };
  }, [block, fields]);
  const result: Record<string, unknown> = useMemo(() => {
    const result: Record<string, unknown> = {};
    if (block) {
      for (const field of fields) {
        result[field] = propMap[field].value.convert(block.getValue(field), block, propMap[field]);
      }
    }
    return result;
  }, [block, fields, tic]);

  return result as {[K in keyof T]: ReturnType<T[K]['value']['convert']>};
}
