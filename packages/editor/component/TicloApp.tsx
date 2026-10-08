import React, {useCallback, useMemo, useRef, useState, ReactNode} from 'react';
import {TicloCurrentFlowContext, TicloLayoutContext, TicloLayoutContextType, TicloStage} from './LayoutContext.ts';

export interface TicloAppProps<Context extends TicloLayoutContext = TicloLayoutContext> {
  value: Context;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function useTicloContext(value: TicloLayoutContext) {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const currentPathRef = useRef<string | null>(null);
  const [stages, setStages] = useState(() => new Map<string, TicloStage[]>());
  const stagesRef = useRef(stages);
  stagesRef.current = stages;
  currentPathRef.current = currentPath;

  const registerStage = useCallback((path: string, stage: TicloStage) => {
    setStages((previous) => {
      const registered = previous.get(path) ?? [];
      if (registered.includes(stage)) return previous;
      return new Map(previous).set(path, [...registered, stage]);
    });
  }, []);

  const unregisterStage = useCallback((path: string, stage: TicloStage) => {
    setStages((previous) => {
      const registered = previous.get(path);
      if (!registered?.includes(stage)) return previous;
      const next = new Map(previous);
      const remaining = registered.filter((item) => item !== stage);
      if (remaining.length) next.set(path, remaining);
      else next.delete(path);
      return next;
    });
  }, []);

  const currentFlow = useMemo(
    () => ({
      currentPath,
      activeStage: stages.get(currentPath)?.at(-1) ?? null,
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
    [currentPath, stages, registerStage, unregisterStage, value]
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

  const forEachCurrentStage = useCallback((callback: (stage: TicloStage) => boolean) => {
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
            handled = forEachCurrentStage((stage) => stage.save?.() ?? false);
          }
          break;
        }
        case 'c': {
          if (!isEditable && (event.ctrlKey || event.metaKey)) {
            handled = forEachCurrentStage((stage) => stage.copy?.() ?? false);
          }
          break;
        }
        case 'z': {
          if (!isEditable && (event.ctrlKey || event.metaKey) && event.shiftKey) {
            handled = forEachCurrentStage((stage) => stage.redo?.() ?? false);
          } else if (!isEditable && (event.ctrlKey || event.metaKey)) {
            handled = forEachCurrentStage((stage) => stage.undo?.() ?? false);
          }
          break;
        }
        case 'y': {
          if (!isEditable && (event.ctrlKey || event.metaKey)) {
            handled = forEachCurrentStage((stage) => stage.redo?.() ?? false);
          }
          break;
        }
        case 'delete': {
          if (!isEditable) {
            handled = forEachCurrentStage((stage) => stage.deleteSelection?.() ?? false);
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
      if (!isEditable && forEachCurrentStage((stage) => stage.paste?.(event) ?? false)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [forEachCurrentStage]
  );

  return {currentFlow, wrappedLayoutContext, onKeyDown, onPaste};
}

export function TicloApp<Context extends TicloLayoutContext>({
  value,
  children,
  className = 'ticl-e-app',
  style,
}: TicloAppProps<Context>) {
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
