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
export function useRefState<T>(value: T) {
  const [val, setVal] = useState(value);
  const ref = useRef(value);
  return [
    val,
    (value: T) => {
      ref.current = value;
      setVal(value);
    },
    ref,
  ] as const;
}

export function useMemoUpdate<T>(callback: () => T, dependencies: unknown[]) {
  // keep track of changes
  const [tic, update] = useReducer((x) => (x + 1) & 0xffffff, 1);
  dependencies.push(tic);
  return [useMemo(callback, dependencies), update] as const;
}
