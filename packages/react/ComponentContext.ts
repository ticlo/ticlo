import {createContext} from 'react';
import type {Block} from '@ticlo/core';
import type {ElementMap} from './util/ElementMap.ts';

/** Component-facing state and stable selection commands; panel state stays in the designer. */
export interface ComponentContextValue<Item = string> {
  designMode: boolean;
  elementMap?: ElementMap;
  /** Returns true when the operation selects an item that was not already selected. */
  select: (items: Item[]) => boolean;
  addSelection: (items: Item[]) => boolean;
}

export const ComponentContext = createContext<ComponentContextValue<Block | string>>({
  designMode: false,
  select: () => false,
  addSelection: () => false,
});
