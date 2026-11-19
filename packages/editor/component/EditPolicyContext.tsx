import React, {createContext, useContext} from 'react';
import {type ClientConn, EditPolicyView} from '@ticlo/core/editor.ts';

const unrestrictedEditPolicy = new EditPolicyView();
export const EditPolicyContext = createContext<EditPolicyView>(unrestrictedEditPolicy);

export function EditPolicyProvider({conn, children}: {conn: ClientConn; children: React.ReactNode}) {
  return <EditPolicyContext.Provider value={conn.getEditPolicyView()}>{children}</EditPolicyContext.Provider>;
}

export function useEditPolicy() {
  return useContext(EditPolicyContext);
}
