import {useEffect, useMemo, useReducer} from 'react';
import {Block, BlockProperty, FunctionInput} from '@ticlo/core';
import {PropMap} from '../comp/PropType.js';
import {useMemoUpdate} from '../util/react-tools.js';

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
  const fields = useMemo(() => Object.keys(propMap), [propMap]);

  const [result, updateResult] = useMemoUpdate(() => {
    const result: Record<string, unknown> = {};
    if (block) {
      for (const field of fields) {
        result[field] = propMap[field].value.convert(block.getValue(field), block, propMap[field]);
      }
    }
    return result;
  }, [block, fields]);

  useEffect(() => {
    const listener = {onChange: updateResult, onSourceChange: () => {}};
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

  return result as {[K in keyof T]: ReturnType<T[K]['value']['convert']>};
}
