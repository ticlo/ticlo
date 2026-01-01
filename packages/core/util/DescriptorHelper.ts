import {PropDesc} from '../block/Descriptor.js';

export function propAcceptsBlock(desc: PropDesc) {
  return desc.type === 'block' || (desc.type === 'any' && desc.options?.includes('block'));
}
