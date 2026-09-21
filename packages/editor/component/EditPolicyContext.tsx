import React, {createContext, useCallback, useContext, useSyncExternalStore} from 'react';
import {type ClientConn, EditPolicyView} from '@ticlo/core/editor.ts';

const unrestrictedEditPolicy = new EditPolicyView();
export const EditPolicyContext = createContext<EditPolicyView>(unrestrictedEditPolicy);

export function EditPolicyProvider({conn, children}: {conn: ClientConn; children: React.ReactNode}) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const changes = conn.editPolicyChanges();
      changes.listen(onChange);
      return () => changes.unlisten(onChange);
    },
    [conn]
  );
  const snapshot = useCallback(() => conn.getEditPolicyView(), [conn]);
  const policy = useSyncExternalStore(subscribe, snapshot, snapshot);
  return <EditPolicyContext.Provider value={policy}>{children}</EditPolicyContext.Provider>;
}

export function useEditPolicy() {
  return useContext(EditPolicyContext);
}
