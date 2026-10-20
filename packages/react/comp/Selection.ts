import {Block, type PropDesc} from '@ticlo/core';
import {Namespace} from '@ticlo/core/block/Namespace.ts';

export const selectedIndexProperty: PropDesc = {
  name: 'selectedIndex',
  type: 'number',
  step: 1,
};

/** Single selection uses a nonnegative integer; containers choose their own empty/default index. */
export function toSelectedIndex(value: unknown, defaultIndex = -1): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number)) return defaultIndex;
  const index = Math.trunc(number);
  return index < 0 ? defaultIndex : index;
}

/** Optional renderer metadata for revealing a direct child without saving an edit. */
export const revealChildMetaKey = 'react:reveal-child';

export function revealChild(block: Block, child: Block) {
  const functionId = block.getValue('#is');
  if (typeof functionId !== 'string' || !functionId) return;
  const reveal = Namespace.getFunctions(functionId, block._flow)?.getMeta(functionId, revealChildMetaKey) as
    | ((block: Block, child: Block) => void)
    | undefined;
  reveal?.(block, child);
}
