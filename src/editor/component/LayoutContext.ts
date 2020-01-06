import * as React from 'react';
import {PropDesc, PropDispatcher} from '../../../src/core/editor';

export interface TicloLayoutContext {
  editJob?(path: string, onSave: () => void): void;

  editProperty?(paths: string[], propDesc: PropDesc, defaultValue?: any, mime?: string, readonly?: boolean): void;

  showObjectTree?(path: string, value: any, element: HTMLElement, source: any): void;
  closeObjectTree?(path: string, source: any): void;

  selectedPaths?: PropDispatcher<string[]>;
}

export const TicloLayoutContextType = React.createContext<TicloLayoutContext>(null);

export const TicloLayoutContextProvider = TicloLayoutContextType.Provider;
export const TicloLayoutContextConsumer = TicloLayoutContextType.Consumer;
