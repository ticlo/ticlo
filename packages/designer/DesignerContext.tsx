import {useContext, type Context} from 'react';
import type {Block, ClientConn, Flow} from '@ticlo/core';
import type {ElementMap} from '@ticlo/react';
import {
  TicloCurrentFlowContext,
  TicloLayoutContextType,
  type TicloLayoutContext,
  type TicloSelection,
  type TicloStage,
} from '@ticlo/editor/component/LayoutContext.ts';

export interface DesignerLayoutContext extends TicloLayoutContext {
  designMode?: boolean;
  setDesignMode?: (designMode: boolean) => void;
}

// A typed view of the shared context; DesignerApp supplies the extra fields.
export const DesignerLayoutContextType = TicloLayoutContextType as Context<DesignerLayoutContext>;

export interface DesignerSelection extends TicloSelection {
  blocks: Block[];
}

export interface DesignerStageContextValue extends TicloStage<DesignerSelection> {
  kind: 'designer';
  basePath: string;
  flow: Flow | null;
  main: Block | null;
  conn: ClientConn;
  designMode: boolean;
  elementMap: ElementMap;
  setDesignMode: (designMode: boolean) => void;
  selection: DesignerSelection;
  select: (items: (Block | string)[]) => boolean;
  addSelection: (items: (Block | string)[]) => boolean;
  undo: () => boolean;
  redo: () => boolean;
}

/** Outside panels use the same active-stage registry as the dataflow editor. */
export function useActiveDesignerStage(): DesignerStageContextValue | null {
  const {activeStage} = useContext(TicloCurrentFlowContext);
  return activeStage?.kind === 'designer' ? (activeStage as DesignerStageContextValue) : null;
}
