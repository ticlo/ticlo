import React, {useCallback, useContext, useMemo, useRef, useState, ReactNode} from 'react';
import {ConfigProvider, theme} from 'antd';
import {DragLayerContext} from 'rc-dock';
import {
  TicloCurrentFlowContext,
  TicloLayoutContext,
  TicloLayoutContextType,
  TicloStage,
  TicloStageCommand,
} from './LayoutContext.ts';

export interface TicloAppProps<Context extends TicloLayoutContext = TicloLayoutContext> {
  value: Context;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function useTicloContext(value: TicloLayoutContext) {
  const [registry, setRegistry] = useState(() => ({
    stages: new Map<string, TicloStage>(),
    activeId: null as string | null,
    currentPath: null as string | null,
  }));
  const registryRef = useRef(registry);
  const valueRef = useRef(value);
  valueRef.current = value;
  // Update the ref synchronously so focus and commands in the same event use the same stage.
  const updateRegistry = useCallback((update: (previous: typeof registry) => typeof registry) => {
    const next = update(registryRef.current);
    if (next === registryRef.current) return;
    registryRef.current = next;
    setRegistry(next);
  }, []);

  const registerStage = useCallback(
    (stage: TicloStage) => {
      updateRegistry((previous) => {
        if (previous.stages.get(stage.id) === stage) return previous;
        return {
          ...previous,
          stages: new Map(previous.stages).set(stage.id, stage),
          currentPath: previous.activeId === stage.id ? stage.basePath : previous.currentPath,
        };
      });
    },
    [updateRegistry]
  );

  const unregisterStage = useCallback(
    (id: string) => {
      updateRegistry((previous) => {
        if (!previous.stages.has(id)) return previous;
        const stages = new Map(previous.stages);
        stages.delete(id);
        return previous.activeId === id ? {stages, activeId: null, currentPath: null} : {...previous, stages};
      });
    },
    [updateRegistry]
  );

  const activateStage = useCallback(
    (id: string) => {
      const stage = registryRef.current.stages.get(id);
      updateRegistry((previous) =>
        previous.activeId === id ? previous : {...previous, activeId: id, currentPath: stage?.basePath ?? null}
      );
      if (stage) valueRef.current.onFlowFocus?.(stage.basePath);
    },
    [updateRegistry]
  );

  const runStageCommand = useCallback((...command: TicloStageCommand) => {
    const {stages, activeId} = registryRef.current;
    const stage = stages.get(activeId);
    if (command[0] === 'paste') return stage?.paste?.(command[1]) ?? false;
    return stage?.[command[0]]?.() ?? false;
  }, []);

  const currentFlow = useMemo(
    () => ({
      currentPath: registry.currentPath,
      activeStage: registry.stages.get(registry.activeId) ?? null,
      activateStage,
      runStageCommand,
      onFlowFocus: (path: string) => {
        updateRegistry((previous) => {
          if (previous.currentPath === path) return previous;
          const stage = [...previous.stages.values()].findLast((stage) => stage.basePath === path);
          return {...previous, currentPath: path, activeId: stage?.id ?? null};
        });
        value.onFlowFocus?.(path);
      },
      onFlowClosed: (path: string) => {
        updateRegistry((previous) =>
          previous.currentPath === path ? {...previous, activeId: null, currentPath: null} : previous
        );
        value.onFlowClosed?.(path);
      },
      registerStage,
      unregisterStage,
    }),
    [registry, activateStage, runStageCommand, updateRegistry, registerStage, unregisterStage, value]
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
            handled = runStageCommand('save');
          }
          break;
        }
        case 'c': {
          if (!isEditable && (event.ctrlKey || event.metaKey)) {
            handled = runStageCommand('copy');
          }
          break;
        }
        case 'z': {
          if (!isEditable && (event.ctrlKey || event.metaKey) && event.shiftKey) {
            handled = runStageCommand('redo');
          } else if (!isEditable && (event.ctrlKey || event.metaKey)) {
            handled = runStageCommand('undo');
          }
          break;
        }
        case 'y': {
          if (!isEditable && (event.ctrlKey || event.metaKey)) {
            handled = runStageCommand('redo');
          }
          break;
        }
        case 'delete': {
          if (!isEditable) {
            handled = runStageCommand('deleteSelection');
          }
          break;
        }
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [runStageCommand]
  );

  const onPaste = useCallback(
    (event: React.ClipboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const isEditable =
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]') != null;
      if (!isEditable && runStageCommand('paste', event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [runStageCommand]
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
  const cssVar = useContext(ConfigProvider.ConfigContext).theme?.cssVar;
  const themeClass = typeof cssVar === 'object' ? cssVar.key : 'css-var-root';
  const {token} = theme.useToken();
  const initDragLayer = useCallback(
    (layer: HTMLDivElement) => {
      layer.classList.add(themeClass);
      layer.style.fontFamily = token.fontFamily;
      layer.style.color = 'var(--ant-color-text)';
    },
    [themeClass, token.fontFamily]
  );
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
    <DragLayerContext.Provider value={initDragLayer}>
      <TicloCurrentFlowContext.Provider value={currentFlow}>
        <TicloLayoutContextType.Provider value={wrappedLayoutContext}>
          <div className={className} style={rootStyle} onKeyDown={onKeyDown} onPaste={onPaste}>
            {children}
          </div>
        </TicloLayoutContextType.Provider>
      </TicloCurrentFlowContext.Provider>
    </DragLayerContext.Provider>
  );
}
