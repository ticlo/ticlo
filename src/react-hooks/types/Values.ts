import {DateTime} from 'luxon';
import {toDateTime} from '@ticlo/core/util/DateTime';
import {Block, PropDesc} from '@ticlo/core';
import {getDefaultZone} from '@ticlo/core/util/Settings';

type DescOmit = Omit<PropDesc, 'name'>;

const emptyArray: unknown[] = [];

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
    convert: (value: unknown): string => {
      if (typeof value === 'string') {
        return value;
      }
      if (value == null) {
        return undefined;
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
    convert: (value: unknown, block?: Block, desc?: Partial<PropDesc>): string => {
      if (typeof value === 'string') {
        if (desc.options.includes(value)) {
          return value as string;
        }
        if (desc.default !== undefined) {
          return desc.default as string;
        }
      }
      return undefined;
    },
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
  array: {
    convert: (value: unknown): unknown[] => {
      if (Array.isArray(value)) {
        return value;
      }
      return emptyArray;
    },
    desc: {type: 'array'} as DescOmit,
  },
  arrayOptional: {
    convert: (value: unknown): unknown[] | undefined => {
      if (Array.isArray(value)) {
        return value;
      }
      return undefined;
    },
    desc: {type: 'array'} as DescOmit,
  },
  any: {
    convert: (value: unknown): unknown => {
      return value;
    },
    desc: {type: 'any'} as DescOmit,
  },
  block: {
    convert: (value: unknown): Block => {
      if (value instanceof Block) {
        return value;
      }
      return undefined;
    },
    desc: {type: 'any'} as DescOmit,
  },
};
