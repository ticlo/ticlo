import {Block} from './Block.ts';
import {type DataMap, isStringArray} from '../util/DataTypes.ts';
import {encodeToUnknown} from '../util/Serialize.ts';

/** Runtime child order forwarded through worker inputs, retaining its original owner. */
export class BlockOrder {
  constructor(
    public readonly owner: Block | DataMap,
    public readonly order: string[]
  ) {}

  static from(owner: Block | DataMap, value: unknown): unknown {
    return isStringArray(value) ? new BlockOrder(owner, value) : value;
  }

  getValue(name: string): unknown {
    return this.owner instanceof Block ? this.owner.getValue(name) : this.owner[name];
  }

  toString() {
    return '#order';
  }
}

encodeToUnknown(BlockOrder);

export function getBlockOrder(block: Block, value: unknown = block.getValue('#order')): BlockOrder | undefined {
  if (value instanceof BlockOrder) return value;
  if (isStringArray(value)) return new BlockOrder(block, value);
}
