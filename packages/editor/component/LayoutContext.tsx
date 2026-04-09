import React, {createContext, useMemo, ReactElement, useState, ReactNode, useRef} from 'react';
import {PropDesc, PropDispatcher} from '@ticlo/core';

export interface TicloLayoutContext {
  editFlow?(path: string, onSave: () => void): void;

  editProperty?(paths: string[], propDesc: PropDesc, defaultValue?: any, mime?: string, readonly?: boolean): void;
  editSchedule?(path: string, scheduleName?: string, index?: number): void;

  showObjectTree?(path: string, value: any, element: HTMLElement, source: any): void;
  closeObjectTree?(path: string, source: any): void;

  showModal?(model: ReactElement): void;

  getSelectedPaths(): PropDispatcher<string[]>;

  onFlowFocus?(path: string, onBlur?: () => void): void;
  onFlowClosed?(path: string): void;

  language: string;
}

export const TicloCurrentFlowContext = createContext<string | undefined>(undefined);
export const TicloCurrentFlowConsumer = TicloCurrentFlowContext.Consumer;

export const TicloLayoutContextType = createContext<TicloLayoutContext>(null);
export const TicloLayoutContextConsumer = TicloLayoutContextType.Consumer;

// alias name to make it easier to read code
export const TicloI18NConsumer = TicloLayoutContextConsumer;

export function TicloContextProvider({value, children}: {value: TicloLayoutContext; children?: ReactNode}) {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const onBlurRef = useRef<() => void>(undefined);
  const wrappedLayoutContext: TicloLayoutContext = useMemo(() => {
    return {
      ...value,
      onFlowFocus: (path: string, onBlur?: () => void) => {
        setCurrentPath((prev) => {
          if (prev === path) {
            return prev;
          }
          if (onBlurRef.current) {
            onBlurRef.current();
          }
          onBlurRef.current = onBlur;
          return path;
        });
        value.onFlowFocus?.(path, onBlur);
      },
      onFlowClosed: (path: string) => {
        setCurrentPath((prev) => {
          if (prev === path) {
            return null;
          }
          onBlurRef.current = undefined;
          return prev;
        });
        value.onFlowClosed?.(path);
      },
    };
  }, [value]);
  return (
    <TicloCurrentFlowContext.Provider value={currentPath}>
      <TicloLayoutContextType.Provider value={wrappedLayoutContext}>{children}</TicloLayoutContextType.Provider>
    </TicloCurrentFlowContext.Provider>
  );
}
