import {useContext, useMemo, type Ref} from 'react';
import type {Block} from '@ticlo/core';
import type {ElementMap} from '../util/ElementMap.ts';
import {ComponentRenderContext} from '../ComponentContext.ts';

function attachRef(ref: Ref<Element> | undefined, element: Element | null): (() => void) | undefined {
  if (typeof ref === 'function') {
    const cleanup = ref(element);
    return typeof cleanup === 'function'
      ? cleanup
      : () => {
          ref(null);
        };
  }
  if (ref) {
    ref.current = element;
    return () => {
      if (ref.current === element) ref.current = null;
    };
  }
}

/** Register editable Blocks or their delegated roots, while preserving component refs. */
export function useComponentRef(
  block: Block,
  elementMap: ElementMap | undefined,
  ref: Ref<Element> | undefined,
  optionalRef: Ref<Element> | undefined
) {
  const context = useContext(ComponentRenderContext);
  const map = context ? context.context.elementMap : elementMap;
  const owner = context
    ? block === context.main && context.owner
      ? context.owner
      : block._flow === context.flow
        ? block
        : undefined
    : block;
  return useMemo(
    () => (element: Element | null) => {
      const disconnect = element && owner ? map?.connect(owner, element) : undefined;
      const cleanups = [...new Set([ref, optionalRef])].map((target) => attachRef(target, element));
      return () => {
        disconnect?.();
        for (const cleanup of cleanups) cleanup?.();
      };
    },
    [owner, map, ref, optionalRef]
  );
}
