import {createContext, useContext} from 'react';
import type {Block, ClientConn, Flow} from '@ticlo/core';
import {TicloCurrentFlowContext, type TicloSelection, type TicloStage} from '@ticlo/editor/component/LayoutContext.ts';

export interface DesignerSelection extends TicloSelection {
  blocks: Block[];
}

export interface DesignerStageContextValue extends TicloStage<DesignerSelection> {
  kind: 'designer';
  basePath: string;
  flow: Flow | null;
  main: Block | null;
  conn: ClientConn;
  selection: DesignerSelection;
  select: (items: (Block | string)[]) => void;
}

export const DesignerStageContext = createContext<DesignerStageContextValue | null>(null);

/** Outside panels use the same active-stage registry as the dataflow editor. */
export function useActiveDesignerStage(): DesignerStageContextValue | null {
  const {activeStage} = useContext(TicloCurrentFlowContext);
  return activeStage?.kind === 'designer' ? (activeStage as DesignerStageContextValue) : null;
}
