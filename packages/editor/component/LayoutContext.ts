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

export interface TicloSelection {
  paths: string[];
}

export interface TicloStage<Selection extends TicloSelection = TicloSelection> extends Partial<TicloStageCommands> {
  kind: string;
  selection: Selection;
  select: (paths: string[]) => void;
}

export interface TicloCurrentFlow<Stage extends TicloStage = TicloStage> {
  currentPath?: string | null;
  activeStage: Stage | null;
  onFlowFocus: (path: string) => void;
  onFlowClosed: (path: string) => void;
  registerStage: (path: string, stage: Stage) => void;
  unregisterStage: (path: string, stage: Stage) => void;
}

export interface TicloLayoutContext<Stage extends TicloStage = TicloStage> extends Partial<TicloCurrentFlow<Stage>> {
  editFlow?(path: string, onSave: () => void): void;

  editProperty?(
    paths: string[],
    propDesc: PropDesc,
    defaultValue?: any,
    mime?: string,
    readonly?: boolean,
    isOptional?: boolean
  ): void;
  editSchedule?(path: string, scheduleName?: string, index?: number): void;

  showObjectTree?(path: string, value: any, element: HTMLElement, source: any): void;
  closeObjectTree?(path: string, source: any): void;

  showModal?(model: React.ReactElement): void;

  getSelectedPaths?(): PropDispatcher<string[]>;

  language?: string;
}

export const TicloCurrentFlowContext = createContext<TicloCurrentFlow>({
  activeStage: null,
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
