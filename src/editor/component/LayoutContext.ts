import * as React from 'react';
import {PropDesc, PropDispatcher} from '../../../src/core/editor';

export interface TicloLayoutContext {
  editFlow?(path: string, onSave: () => void): void;

  editProperty?(paths: string[], propDesc: PropDesc, defaultValue?: any, mime?: string, readonly?: boolean): void;
  editSchedule?(path: string, selectedIndex?: number): void;

  showObjectTree?(path: string, value: any, element: HTMLElement, source: any): void;
  closeObjectTree?(path: string, source: any): void;

  showModal?(model: React.ReactElement): void;

  getSelectedPaths(): PropDispatcher<string[]>;
}

export const TicloLayoutContextType = React.createContext<TicloLayoutContext>(null);

export const TicloLayoutContextProvider = TicloLayoutContextType.Provider;
export const TicloLayoutContextConsumer = TicloLayoutContextType.Consumer;

// alias name to make it easier to read code
export const TicloI18NConsumer = TicloLayoutContextConsumer;
