import {Block, FunctionDesc, PropDesc, ValueType} from '@ticlo/core';

export interface ValueConverter {
  convert: (value: unknown, block?: Block, type?: Partial<PropDesc>) => any;
  desc: Omit<PropDesc, 'name'>;
}

export type PropType = {value: ValueConverter} & Omit<PropDesc, 'name' | 'type'> & {
    type?: ValueType;
  };

export type PropMap = Record<string, PropType>;
