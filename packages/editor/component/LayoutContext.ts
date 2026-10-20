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

export type TicloStageCommand =
  | [command: Exclude<keyof TicloStageCommands, 'paste'>]
  | [command: 'paste', event: React.ClipboardEvent];

export interface TicloSelection {
  paths: string[];
}

export interface TicloStage<Selection extends TicloSelection = TicloSelection> extends Partial<TicloStageCommands> {
  id: string;
  basePath: string;
  kind: string;
  functionTreeTags?: readonly string[];
  nodeTreeTags?: readonly string[];
  selection: Selection;
  select: (paths: string[]) => void;
}

export interface TicloCurrentFlow<Stage extends TicloStage = TicloStage> {
  currentPath?: string | null;
  activeStage: Stage | null;
  activateStage: (id: string) => void;
  runStageCommand: (...command: TicloStageCommand) => boolean;
  onFlowFocus: (path: string) => void;
  onFlowClosed: (path: string) => void;
  registerStage: (stage: Stage) => void;
  unregisterStage: (id: string) => void;
}

export interface TicloLayoutContext<Stage extends TicloStage = TicloStage> extends Partial<TicloCurrentFlow<Stage>> {
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
  activeStage: null,
  activateStage: voidFunction,
  runStageCommand: () => false,
  onFlowFocus: voidFunction,
  onFlowClosed: voidFunction,
  registerStage: voidFunction,
  unregisterStage: voidFunction,
});
export const TicloCurrentFlowConsumer = TicloCurrentFlowContext.Consumer;

export const TicloLayoutContextType = createContext<TicloLayoutContext>({
  activateStage: voidFunction,
  runStageCommand: () => false,
  onFlowFocus: voidFunction,
  onFlowClosed: voidFunction,
  registerStage: voidFunction,
  unregisterStage: voidFunction,
});
export const TicloLayoutContextConsumer = TicloLayoutContextType.Consumer;

export const TicloI18NConsumer = TicloLayoutContextConsumer;
