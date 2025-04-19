import {useEffect, useMemo, useReducer} from 'react';
import {Block, BlockProperty, FunctionInput} from '@ticlo/core';
import {PropMap} from '../types/PropType';

/**
 * Get an object with all the properties
 * @param block
 * @param propMap - properties to listen to
 */
export function useBlockProps<T extends PropMap>(
  block: Block,
  propMap: T
): {[K in keyof T]: ReturnType<T[K]['value']['convert']>} {
  const [, forceUpdate] = useReducer((x) => -x, 1);

  const fields = useMemo(() => Object.keys(propMap), [propMap]);

  useEffect(() => {
    if (fields.length < 5) {
      const listener = {onChange: forceUpdate, onSourceChange: () => {}};
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
    } else {
      // listen to all changes when there are too many fields
      const listener = {
        onChildChange(property: BlockProperty) {
          if (fields.includes(property._name)) {
            forceUpdate();
          }
        },
      };
      block.watch(listener);
      return () => {
        block.unwatch(listener);
      };
    }
  }, [block, fields]);
  const result: Record<string, unknown> = {};
  if (block) {
    for (const field of fields) {
      result[field] = propMap[field].value.convert(block.getValue(field), block, propMap[field]);
    }
  }

  return result as {[K in keyof T]: ReturnType<T[K]['value']['convert']>};
}
