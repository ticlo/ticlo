import {useRef, useMemo, useState, useReducer} from 'react';

// A ref that always points to the latest value
export function useValueRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

// A ref that always points to the latest value computed by a callback
export function useMemoRef<T>(callback: () => T, dependencies: unknown[]) {
  const ref = useRef<T>();
  ref.current = useMemo(callback, dependencies);
  return ref;
}

// useState but also keep the value in a ref
// writing value would cause re-render, but reading value won't need a dependency update
export function useRefState<T>(init: () => T) {
  const [val, setVal] = useState(init);
  const ref = useRef(val);
  return [
    val,
    (value: T) => {
      ref.current = value;
      setVal(value);
    },
    ref,
  ] as const;
}

// Pass a fresh, unshared array each render; the update tick is appended in place.
export function useMemoUpdate<T>(callback: () => T, mutableDependencies: unknown[]) {
  // keep track of changes
  const [tic, update] = useReducer((x) => (x + 1) & 0xffffff, 1);
  mutableDependencies.push(tic);
  return [useMemo(callback, mutableDependencies), update] as const;
}
