import {createContext} from 'react';
import type {Block} from '@ticlo/core';

/** Component-facing state and stable selection commands; panel state stays in the designer. */
export interface ComponentContextValue<Item = string> {
  designMode: boolean;
  select: (items: Item[]) => void;
  addSelection: (items: Item[]) => void;
}

export const ComponentContext = createContext<ComponentContextValue<Block | string>>({
  designMode: false,
  select: () => {},
  addSelection: () => {},
});
