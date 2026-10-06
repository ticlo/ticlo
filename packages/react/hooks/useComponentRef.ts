import {useMemo, type Ref} from 'react';
import type {Block} from '@ticlo/core';
import type {ElementMap} from '../util/ElementMap.ts';

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

/** Share the root DOM node with the page registry and the component's own refs. */
export function useComponentRef(
  block: Block,
  elementMap: ElementMap | undefined,
  ref: Ref<Element> | undefined,
  optionalRef: Ref<Element> | undefined
) {
  return useMemo(
    () => (element: Element | null) => {
      const disconnect = element ? elementMap?.connect(block, element) : undefined;
      const cleanups = [...new Set([ref, optionalRef])].map((target) => attachRef(target, element));
      return () => {
        disconnect?.();
        for (const cleanup of cleanups) cleanup?.();
      };
    },
    [block, elementMap, ref, optionalRef]
  );
}
