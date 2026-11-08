import {useMemo, useSyncExternalStore} from 'react';
import {Block} from '@ticlo/core';

export function useBlockValue<T = unknown>(block: Block, name: string): T {
  const store = useMemo(
    () => ({
      getSnapshot: () => block.getValue(name) as T,
      subscribe: (onChange: () => void) => {
        const property = block.getProperty(name, true);
        const listener = {onChange};
        property.listen(listener);
        return () => property.unlisten(listener);
      },
    }),
    [block, name]
  );
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
