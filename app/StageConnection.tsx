import React, {createContext, useContext, useMemo} from 'react';
import type {ClientConn} from '@ticlo/core';
import type {TabData} from 'rc-dock';

export const StageConnectionContext = createContext<ClientConn>(null);

/** Live policy preview for stage and property panels. */
export function StageConnection({
  children,
  readonly = false,
}: {
  children: React.ReactElement<{conn: ClientConn}>;
  readonly?: boolean;
}) {
  const current = useContext(StageConnectionContext);
  const conn = useMemo(
    () => (readonly ? current.withPolicy({...current.getEditPolicyView().policy, readonly: true}) : current),
    [current, readonly]
  );
  return React.cloneElement(children, {conn});
}

export function connectStageTab(tab: TabData, readonly = false) {
  if (React.isValidElement<{conn: ClientConn}>(tab.content))
    tab.content = <StageConnection readonly={readonly}>{tab.content}</StageConnection>;
  if (React.isValidElement<{conn: ClientConn}>(tab.title))
    tab.title = <StageConnection readonly={readonly}>{tab.title}</StageConnection>;
  return tab;
}
