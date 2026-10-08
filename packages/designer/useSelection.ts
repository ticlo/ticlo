import {useCallback, useEffect} from 'react';
import {Block} from '@ticlo/core';
import {useRefState} from '@ticlo/react/util/react-tools.ts';
import type {DesignerSelection} from './DesignerContext.tsx';

function resolveSelection(
  root: Block,
  main: Block | null,
  items: (Block | string)[],
  parent?: Block
): DesignerSelection {
  const blocks: Block[] = [];
  const paths: string[] = [];
  const mainPath = main?.getFullPath();
  if (main) {
    for (const item of items) {
      const block = typeof item === 'string' ? root.queryValue(item) : item;
      if (!(block instanceof Block) || block._destroyed || blocks.includes(block)) continue;
      if (parent && block.getParent() !== parent) continue;
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
  const [selection, setSelection, selectionRef] = useRefState<DesignerSelection>(() => ({blocks: [], paths: []}));
  const updateSelection = useCallback(
    (items?: (Block | string)[], append = false) => {
      const previous = selectionRef.current;
      const current = append ? resolveSelection(root, main, items.slice().reverse()).blocks[0] : undefined;
      const next = resolveSelection(
        root,
        main,
        append ? [...previous.blocks, ...items] : (items ?? previous.blocks),
        current?.getParent()
      );
      const added = next.blocks.some((block) => !previous.blocks.includes(block));
      if (
        next.blocks.length !== previous.blocks.length ||
        next.blocks.some((block, i) => block !== previous.blocks[i] || next.paths[i] !== previous.paths[i])
      ) {
        setSelection(next);
      }
      return added;
    },
    [root, main]
  );
  const select = useCallback((items: (Block | string)[]) => updateSelection(items), [updateSelection]);
  const addSelection = useCallback((items: (Block | string)[]) => updateSelection(items, true), [updateSelection]);
  useEffect(() => {
    select([]);
  }, [select]);
  useEffect(() => {
    const listener = {onChange: () => updateSelection(), onSourceChange: () => updateSelection()};
    const bindings = selection.paths.map((path) => root.createBinding(path, listener));
    return () => {
      for (const binding of bindings) {
        if (!binding.isDestroyed()) binding.unlisten(listener);
      }
    };
  }, [root, selection.paths, updateSelection]);
  return {selection, selectionRef, select, addSelection};
}
