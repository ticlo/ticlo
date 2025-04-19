import {DateTime} from 'luxon';
import {toDateTime} from '@ticlo/core/util/DateTime';
import {Block, FunctionDesc, PropDesc} from '@ticlo/core';
import {getDefaultZone} from '@ticlo/core/util/Settings';
import {ValueConverter} from './PropType';

type DescOmit = Omit<PropDesc, 'name'>;

export const Values = {
  number: {
    convert: (value: unknown) => {
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'string') {
        return parseFloat(value);
      }
      return NaN;
    },
    desc: {type: 'number'} as DescOmit,
  },
  cssSize: {
    convert: (value: unknown) => {
      if (typeof value === 'number') {
        if (Number.isFinite(value)) {
          return value;
        }
      }
      if (typeof value === 'string') {
        return value;
      }
      return undefined;
    },
    desc: {type: 'any', types: ['number', 'string']} as DescOmit,
  },
  string: {
    convert: (value: unknown) => {
      if (typeof value === 'string') {
        return value;
      }
      if (value == null) {
        return value;
      }
      return String(value);
    },
    desc: {type: 'string'} as DescOmit,
  },
  boolean: {
    convert: (value: unknown) => {
      return Boolean(value);
    },
    desc: {type: 'toggle'} as DescOmit,
  },
  integer: {
    convert: (value: unknown) => {
      const n = Values.number.convert(value);
      if (Number.isFinite(n)) {
        return Math.round(n);
      }
      return undefined;
    },
    desc: {type: 'number'} as DescOmit,
  },
  select: {
    convert: (value: unknown, block?: Block, desc?: Partial<FunctionDesc>) => {},
    desc: {type: 'select'} as DescOmit,
  },
  date: {
    convert: (value: unknown): Date | null => {
      if (typeof value === 'number') {
        return new Date(value);
      }
      if (typeof value === 'string') {
        return new Date(value);
      }
      if (DateTime.isDateTime(value)) {
        return value.toJSDate();
      }
      return null;
    },
    desc: {type: 'date'} as DescOmit,
  },
  luxon: {
    convert: (value: unknown, block?: Block): DateTime => {
      let timezone = block?.getValue('timezone') as string;
      if (typeof timezone !== 'string' || timezone === 'Factory' || timezone === 'auto') {
        timezone = getDefaultZone();
      }
      return toDateTime(value, timezone);
    },
    desc: {type: 'date'} as DescOmit,
  },
};
