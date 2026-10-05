import {useCallback, useEffect, useState} from 'react';
import {Block} from '@ticlo/core';
import type {DesignerSelection} from './DesignerContext.tsx';

function resolveSelection(root: Block, main: Block | null, items: (Block | string)[]): DesignerSelection {
  const blocks: Block[] = [];
  const paths: string[] = [];
  const mainPath = main?.getFullPath();
  if (main) {
    for (const item of items) {
      const block = typeof item === 'string' ? root.queryValue(item) : item;
      if (!(block instanceof Block) || block._destroyed || blocks.includes(block)) continue;
      const path = block.getFullPath();
      if (path !== mainPath && !path.startsWith(`${mainPath}.`)) continue;
      if (root.queryValue(path) !== block) continue;
      blocks.push(block);
      paths.push(path);
    }
  }
  return {blocks, paths};
}

export function useSelection(root: Block, main: Block | null) {
  const [selection, setSelection] = useState<DesignerSelection>({blocks: [], paths: []});
  const updateSelection = useCallback(
    (items?: (Block | string)[], append = false) => {
      setSelection((previous) => {
        const next = resolveSelection(root, main, append ? [...previous.blocks, ...items] : (items ?? previous.blocks));
        return next.blocks.length === previous.blocks.length &&
          next.blocks.every((block, i) => block === previous.blocks[i] && next.paths[i] === previous.paths[i])
          ? previous
          : next;
      });
    },
    [root, main]
  );
  const select = useCallback((items: (Block | string)[]) => updateSelection(items), [updateSelection]);
  const addSelection = useCallback((items: (Block | string)[]) => updateSelection(items, true), [updateSelection]);
  useEffect(() => select([]), [select]);
  useEffect(() => {
    const listener = {onChange: () => updateSelection(), onSourceChange: () => updateSelection()};
    const bindings = selection.paths.map((path) => root.createBinding(path, listener));
    return () => {
      for (const binding of bindings) {
        if (!binding.isDestroyed()) binding.unlisten(listener);
      }
    };
  }, [root, selection.paths, updateSelection]);
  return {selection, select, addSelection};
}
