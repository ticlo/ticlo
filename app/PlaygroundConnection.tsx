import React, {createContext, useContext} from 'react';
import type {ClientConn} from '@ticlo/core';

export const PlaygroundConnectionContext = createContext<ClientConn>(null);

/** Live policy preview for the playground's stage and property panels. */
export function PlaygroundConnection({children}: {children: React.ReactElement<{conn: ClientConn}>}) {
  const conn = useContext(PlaygroundConnectionContext);
  return React.cloneElement(children, {conn});
}
