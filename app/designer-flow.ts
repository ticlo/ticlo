import {Block, Flow} from '@ticlo/core';
import {isValidElement} from 'react';

export function usesDesignerStage(flow: unknown): boolean {
  if (!(flow instanceof Flow)) return false;
  const type = flow.getValue('#is');
  if (type !== 'flow:main' && type !== 'flow:worker') return false;
  const main = flow.getValue('#main');
  if (main instanceof Block || isValidElement(main)) return true;
  if (main != null) return false;
  return !flow.findFirst((_, value, prop) => (value instanceof Block && value._prop === prop ? true : undefined));
}
