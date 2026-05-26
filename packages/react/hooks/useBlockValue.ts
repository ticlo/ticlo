import {useEffect, useRef, useState} from 'react';
import {Block} from '@ticlo/core';

export function useBlockValue<T = unknown>(block: Block, name: string): T {
  const [value, setValue] = useState(() => block.getValue(name) as T);
  const listener = useRef({onChange: setValue, onSourceChange: () => {}}).current;

  useEffect(() => {
    const property = block.getProperty(name, true);
    property.listen(listener);
    return () => property.unlisten(listener);
  }, [block, name, listener]);

  return value;
}
