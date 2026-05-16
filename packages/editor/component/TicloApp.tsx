import React, {useCallback, useMemo, useRef, useState, ReactNode} from 'react';
import {
  TicloCurrentFlowContext,
  TicloLayoutContext,
  TicloLayoutContextType,
  TicloStageCommands,
} from './LayoutContext.js';

interface TicloAppProps {
  value: TicloLayoutContext;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function useTicloContext(value: TicloLayoutContext) {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const currentPathRef = useRef<string | null>(null);
  const stagesRef = useRef(new Map<string, TicloStageCommands[]>());
  currentPathRef.current = currentPath;

  const registerStage = useCallback((path: string, stage: TicloStageCommands) => {
    let stages = stagesRef.current.get(path);
    if (!stages) {
      stages = [];
      stagesRef.current.set(path, stages);
    }
    if (!stages.includes(stage)) {
      stages.push(stage);
    }
  }, []);

  const unregisterStage = useCallback((path: string, stage: TicloStageCommands) => {
    const stages = stagesRef.current.get(path);
    if (stages) {
      const index = stages.indexOf(stage);
      if (index >= 0) {
        stages.splice(index, 1);
        if (!stages.length) {
          stagesRef.current.delete(path);
        }
      }
    }
  }, []);

  const currentFlow = useMemo(
    () => ({
      currentPath,
      onFlowFocus: (path: string) => {
        setCurrentPath((prev) => {
          if (prev === path) {
            return prev;
          }
          return path;
        });
        value.onFlowFocus?.(path);
      },
      onFlowClosed: (path: string) => {
        setCurrentPath((prev) => {
          if (prev === path) {
            return null;
          }
          return prev;
        });
        value.onFlowClosed?.(path);
      },
      registerStage,
      unregisterStage,
    }),
    [currentPath, registerStage, unregisterStage, value]
  );

  const wrappedLayoutContext: TicloLayoutContext = useMemo(
    () => ({
      ...value,
      ...currentFlow,
      editFlow: value.editFlow
        ? (path: string, onSave: () => void) => {
            value.editFlow(path, onSave);
            currentFlow.onFlowFocus(path);
          }
        : undefined,
    }),
    [value, currentFlow]
  );

  const forEachCurrentStage = useCallback((callback: (stage: TicloStageCommands) => boolean) => {
    const currentPath = currentPathRef.current;
    if (!currentPath) {
      return false;
    }
    const stages = stagesRef.current.get(currentPath);
    if (stages) {
      for (const stage of stages.concat()) {
        if (callback(stage)) {
          return true;
        }
      }
    }
    return false;
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const isEditable =
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]') != null;
      const key = event.key.toLowerCase();
      let handled = false;

      switch (key) {
        case 's': {
          if (event.ctrlKey || event.metaKey) {
            handled = forEachCurrentStage((stage) => stage.save());
          }
          break;
        }
        case 'c': {
          if (!isEditable && (event.ctrlKey || event.metaKey)) {
            handled = forEachCurrentStage((stage) => stage.copy());
          }
          break;
        }
        case 'z': {
          if (!isEditable && (event.ctrlKey || event.metaKey) && event.shiftKey) {
            handled = forEachCurrentStage((stage) => stage.redo());
          } else if (!isEditable && (event.ctrlKey || event.metaKey)) {
            handled = forEachCurrentStage((stage) => stage.undo());
          }
          break;
        }
        case 'y': {
          if (!isEditable && (event.ctrlKey || event.metaKey)) {
            handled = forEachCurrentStage((stage) => stage.redo());
          }
          break;
        }
        case 'delete': {
          if (!isEditable) {
            handled = forEachCurrentStage((stage) => stage.deleteSelection());
          }
          break;
        }
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [forEachCurrentStage]
  );

  const onPaste = useCallback(
    (event: React.ClipboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const isEditable =
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]') != null;
      if (!isEditable && forEachCurrentStage((stage) => stage.paste(event))) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [forEachCurrentStage]
  );

  return {currentFlow, wrappedLayoutContext, onKeyDown, onPaste};
}

export function TicloApp({value, children, className = 'ticl-app', style}: TicloAppProps) {
  const {currentFlow, wrappedLayoutContext, onKeyDown, onPaste} = useTicloContext(value);
  const rootStyle: React.CSSProperties = useMemo(
    () => ({
      position: 'relative',
      width: '100%',
      height: '100%',
      ...style,
    }),
    [style]
  );

  return (
    <TicloCurrentFlowContext.Provider value={currentFlow}>
      <TicloLayoutContextType.Provider value={wrappedLayoutContext}>
        <div className={className} style={rootStyle} onKeyDown={onKeyDown} onPaste={onPaste}>
          {children}
        </div>
      </TicloLayoutContextType.Provider>
    </TicloCurrentFlowContext.Provider>
  );
}
