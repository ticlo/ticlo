import React, {createContext} from 'react';
import {PropDesc, PropDispatcher, voidFunction} from '@ticlo/core';

export interface TicloStageCommands {
  save(): boolean;
  copy(): boolean;
  paste(event: React.ClipboardEvent): boolean;
  undo(): boolean;
  redo(): boolean;
  deleteSelection(): boolean;
}

export interface TicloCurrentFlow {
  currentPath?: string | null;
  onFlowFocus: (path: string) => void;
  onFlowClosed: (path: string) => void;
  registerStage: (path: string, stage: TicloStageCommands) => void;
  unregisterStage: (path: string, stage: TicloStageCommands) => void;
}

export interface TicloLayoutContext extends Partial<TicloCurrentFlow> {
  editFlow?(path: string, onSave: () => void): void;

  editProperty?(paths: string[], propDesc: PropDesc, defaultValue?: any, mime?: string, readonly?: boolean): void;
  editSchedule?(path: string, scheduleName?: string, index?: number): void;

  showObjectTree?(path: string, value: any, element: HTMLElement, source: any): void;
  closeObjectTree?(path: string, source: any): void;

  showModal?(model: React.ReactElement): void;

  getSelectedPaths?(): PropDispatcher<string[]>;

  language?: string;
}

export const TicloCurrentFlowContext = createContext<TicloCurrentFlow>({
  onFlowFocus: voidFunction,
  onFlowClosed: voidFunction,
  registerStage: voidFunction,
  unregisterStage: voidFunction,
});
export const TicloCurrentFlowConsumer = TicloCurrentFlowContext.Consumer;

export const TicloLayoutContextType = createContext<TicloLayoutContext>({
  onFlowFocus: voidFunction,
  onFlowClosed: voidFunction,
  registerStage: voidFunction,
  unregisterStage: voidFunction,
});
export const TicloLayoutContextConsumer = TicloLayoutContextType.Consumer;

export const TicloI18NConsumer = TicloLayoutContextConsumer;
