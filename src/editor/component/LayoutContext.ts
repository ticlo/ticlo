import * as React from 'react';
import {PropDesc} from '../../core/block/Descriptor';

export interface TicloLayoutContext {
  editJob?(path: string, onSave: () => void): void;

  editProperty?(keys: string[], field: string, propDesc: PropDesc): void;
}

export const TicloLayoutContextType = React.createContext<TicloLayoutContext>(null);

export const TicloLayoutContextProvider = TicloLayoutContextType.Provider;
export const TicloLayoutContextConsumer = TicloLayoutContextType.Consumer;
