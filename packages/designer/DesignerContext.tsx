import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import type {Block, ClientConn, Flow} from '@ticlo/core';
import {TicloCurrentFlowContext} from '@ticlo/editor/component/LayoutContext.ts';

export interface DesignerStageContextValue {
  basePath: string;
  flow: Flow | null;
  conn: ClientConn;
  selectedComponents: Block[];
  setSelectedComponents: React.Dispatch<React.SetStateAction<Block[]>>;
}

export const DesignerStageContext = createContext<DesignerStageContextValue | null>(null);

export interface DesignerContextValue {
  activeStage: DesignerStageContextValue | null;
  registerStage: (stage: DesignerStageContextValue) => () => void;
}

export const DesignerContext = createContext<DesignerContextValue | null>(null);

/** Place inside TicloApp so stage activation follows the app's active flow. */
export function DesignerProvider({children}: {children: React.ReactNode}) {
  const {currentPath} = useContext(TicloCurrentFlowContext);
  const [stages, setStages] = useState(() => new Map<string, DesignerStageContextValue>());
  const registerStage = useCallback((stage: DesignerStageContextValue) => {
    setStages((previous) => new Map(previous).set(stage.basePath, stage));
    return () => {
      setStages((previous) => {
        if (previous.get(stage.basePath) !== stage) return previous;
        const next = new Map(previous);
        next.delete(stage.basePath);
        return next;
      });
    };
  }, []);
  const value = useMemo(
    () => ({activeStage: stages.get(currentPath) ?? null, registerStage}),
    [stages, currentPath, registerStage]
  );
  return <DesignerContext.Provider value={value}>{children}</DesignerContext.Provider>;
}
