import {createContext} from 'react';
import type {Block, Flow} from '@ticlo/core';
import type {ElementMap} from './util/ElementMap.ts';

/** Component-facing state and stable selection commands; panel state stays in the designer. */
export interface ComponentContextValue<Item = string> {
  designMode: boolean;
  elementMap?: ElementMap;
  /** Returns true when the operation selects an item that was not already selected. */
  select: (items: Item[]) => boolean;
  addSelection: (items: Item[]) => boolean;
}

export const defaultComponentContext: ComponentContextValue<Block | string> = {
  designMode: false,
  select: () => false,
  addSelection: () => false,
};

export const ComponentContext = createContext(defaultComponentContext);

/** One editable flow and registry, with the current page's root DOM ownership. */
export const ComponentRenderContext = createContext<{
  flow: Flow;
  context: ComponentContextValue<Block | string>;
  main: Block | undefined;
  owner: Block | undefined;
} | null>(null);
