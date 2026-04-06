import React, {createContext, useMemo, ReactElement, useState, ReactNode} from 'react';
import {PropDesc, PropDispatcher} from '@ticlo/core';

export interface TicloLayoutContext {
  editFlow?(path: string, onSave: () => void): void;

  editProperty?(paths: string[], propDesc: PropDesc, defaultValue?: any, mime?: string, readonly?: boolean): void;
  editSchedule?(path: string, scheduleName?: string, index?: number): void;

  showObjectTree?(path: string, value: any, element: HTMLElement, source: any): void;
  closeObjectTree?(path: string, source: any): void;

  showModal?(model: ReactElement): void;

  getSelectedPaths(): PropDispatcher<string[]>;

  setCurrentFlowPath?(path: string): void;

  language: string;
}

export const TicloCurrentFlowContext = createContext<string | undefined>(undefined);
export const TicloCurrentFlowConsumer = TicloCurrentFlowContext.Consumer;

export const TicloLayoutContextType = createContext<TicloLayoutContext>(null);
export const TicloLayoutContextConsumer = TicloLayoutContextType.Consumer;

// alias name to make it easier to read code
export const TicloI18NConsumer = TicloLayoutContextConsumer;

export function TicloContextProvider({value,children}: {
  value: TicloLayoutContext;
  children?: ReactNode;
}) {
  const [currentPath, setCurrentPath] = useState<string|null>(null);
  const wrappedLayoutContext: TicloLayoutContext = useMemo(() => {
    return {
      ...value,
      setCurrentFlowPath: (path: string)=>{
        setCurrentPath(path);
        value.setCurrentFlowPath?.(path);
      }
    }
  }, [value]);
  return (
    <TicloCurrentFlowContext.Provider value={currentPath}>
      <TicloLayoutContextType.Provider value={wrappedLayoutContext}>
        {children}
      </TicloLayoutContextType.Provider>
    </TicloCurrentFlowContext.Provider>
  );
}
