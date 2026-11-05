import React, {useContext, useMemo, useState, type ReactNode} from 'react';
import {TicloApp, type TicloAppProps} from '@ticlo/editor/component/TicloApp.tsx';
import {TicloLayoutContextType} from '@ticlo/editor/component/LayoutContext.ts';
import {DesignerLayoutContextType, type DesignerLayoutContext} from './DesignerContext.tsx';

function DesignerContextProvider({children}: {children?: ReactNode}) {
  const [designMode, setDesignMode] = useState(true);
  const layout = useContext(TicloLayoutContextType);
  const context = useMemo(() => ({...layout, designMode, setDesignMode}), [layout, designMode, setDesignMode]);
  return <DesignerLayoutContextType.Provider value={context}>{children}</DesignerLayoutContextType.Provider>;
}

export function DesignerApp({value, children, ...props}: TicloAppProps<DesignerLayoutContext>) {
  return (
    <TicloApp value={value} {...props}>
      <DesignerContextProvider>{children}</DesignerContextProvider>
    </TicloApp>
  );
}
