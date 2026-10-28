import React, {createContext, useContext, useMemo} from 'react';
import type {ClientConn} from '@ticlo/core';
import type {TabData} from 'rc-dock';

export const PlaygroundConnectionContext = createContext<ClientConn>(null);

/** Live policy preview for the playground's stage and property panels. */
export function PlaygroundConnection({
  children,
  readonly = false,
}: {
  children: React.ReactElement<{conn: ClientConn}>;
  readonly?: boolean;
}) {
  const current = useContext(PlaygroundConnectionContext);
  const conn = useMemo(
    () => (readonly ? current.withPolicy({...current.getEditPolicyView().policy, readonly: true}) : current),
    [current, readonly]
  );
  return React.cloneElement(children, {conn});
}

export function connectStageTab(tab: TabData, readonly = false) {
  if (React.isValidElement<{conn: ClientConn}>(tab.content))
    tab.content = <PlaygroundConnection readonly={readonly}>{tab.content}</PlaygroundConnection>;
  if (React.isValidElement<{conn: ClientConn}>(tab.title))
    tab.title = <PlaygroundConnection readonly={readonly}>{tab.title}</PlaygroundConnection>;
  return tab;
}
