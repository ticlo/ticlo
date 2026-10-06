import React, {useMemo, useState} from 'react';
import {TicloApp, type TicloAppProps} from '@ticlo/editor/component/TicloApp.tsx';
import type {DesignerLayoutContext} from './DesignerContext.tsx';

export function DesignerApp({value, ...props}: TicloAppProps) {
  const [designMode, setDesignMode] = useState(true);
  const context = useMemo<DesignerLayoutContext>(() => ({...value, designMode, setDesignMode}), [value, designMode]);
  return <TicloApp value={context} {...props} />;
}
