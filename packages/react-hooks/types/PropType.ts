import {Block, FunctionDesc, PropDesc, ValueType} from '@ticlo/core';

export interface ValueConverter {
  convert: (value: unknown, block?: Block, type?: Partial<PropDesc>) => any;
  desc: Omit<PropDesc, 'name'>;
}

export type PropType = {value: ValueConverter} & Omit<PropDesc, 'name' | 'type'> & {
    type?: ValueType;
    // if name is omitted, the key in the PropMap is used
    // use name when 2 different converters share the same property name
    name?: string;
  };

export type PropMap = Record<string, PropType>;
