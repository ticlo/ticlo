import * as React from 'react';
import {PropDesc} from '../../core/block/Descriptor';
import {PropDispatcher} from '../../core/block/Dispatcher';
import {ClientConn} from '../../core/connect/ClientConn';

export interface TicloLayoutContext {
  editJob?(path: string, onSave: () => void): void;

  editProperty?(conn: ClientConn, keys: string[], field: string, propDesc: PropDesc): void;

  showObjectTree?(path: string, value: any, element: HTMLElement, source: any): void;
  closeObjectTree?(path: string, source: any): void;

  selectedKeys?: PropDispatcher<string[]>;
}

export const TicloLayoutContextType = React.createContext<TicloLayoutContext>(null);

export const TicloLayoutContextProvider = TicloLayoutContextType.Provider;
export const TicloLayoutContextConsumer = TicloLayoutContextType.Consumer;
