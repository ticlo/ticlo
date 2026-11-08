import {useMemo, useSyncExternalStore} from 'react';
import {Block, BlockProperty} from '@ticlo/core';
import {PropMap} from '../comp/PropType.ts';

/** Subscribe to mapped properties, including configs and aliased names. */
export function useBlockConfigs<T extends PropMap>(
  block: Block,
  propMap: T
): {[K in keyof T]: ReturnType<T[K]['value']['convert']>} {
  const store = useMemo(() => {
    const fields = Object.keys(propMap);
    const read = () => fields.map((field) => block?.getValue(propMap[field].name || field));
    const convert = (values: unknown[]) => {
      const result: Record<string, unknown> = {};
      if (block) {
        for (let i = 0; i < fields.length; ++i) {
          const field = fields[i];
          result[field] = propMap[field].value.convert(values[i], block, propMap[field]);
        }
      }
      return result;
    };
    let values = read();
    let snapshot = convert(values);
    return {
      getSnapshot: () => snapshot,
      subscribe: (onChange: () => void) => {
        const listener = {
          onChange() {
            const nextValues = read();
            if (nextValues.every((value, i) => Object.is(value, values[i]))) return;
            values = nextValues;
            const next = convert(values);
            if (fields.every((field) => Object.is(next[field], snapshot[field]))) return;
            snapshot = next;
            onChange();
          },
        };
        const properties: BlockProperty[] = [];
        if (block) {
          for (const field of fields) {
            const property = block.getProperty(propMap[field].name || field, true);
            properties.push(property);
            property.listen(listener);
          }
        }
        return () => {
          for (const property of properties) property.unlisten(listener);
        };
      },
    };
  }, [block, propMap]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot) as {
    [K in keyof T]: ReturnType<T[K]['value']['convert']>;
  };
}
