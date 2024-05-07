import {Block} from '../block/Block';
import {DataMap} from '../util/DataTypes';
import {deepEqual} from '../util/Compare';

function toRegex(str: string): RegExp {
  const reg = str.replace(/^\/?/, '').replace(/\/?$/, '');
  return new RegExp(reg);
}

type FilterType = 'all' | 'any' | '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'match' | undefined;
interface Filter {
  type: FilterType;
  field?: string;
  value: unknown;
}

function checkFilter(filter: Filter, block: Block): boolean {
  if (!filter || typeof filter !== 'object') {
    return false;
  }
  const value = filter.value;
  switch (filter.type) {
    case undefined:
      return Boolean(block.getValue(filter.field));
    case '=':
      return deepEqual(block.getValue(filter.field), value);
    case '!=':
      return !deepEqual(block.getValue(filter.field), value);
    case '>':
      return block.getValue(filter.field) > value;
    case '<':
      return block.getValue(filter.field) < value;
    case '>=':
      return block.getValue(filter.field) >= value;
    case '<=':
      return block.getValue(filter.field) <= value;
    case 'in':
      if (Array.isArray(value)) {
        return value.includes(block.getValue(filter.field));
      }
      return false;
    case 'match':
      if (typeof value === 'string') {
        const regex = toRegex(value);
        return regex.test(block.getValue(filter.field) as string);
      }
      return false;
    case 'all':
      if (Array.isArray(value)) {
        for (const f of value as Filter[]) {
          if (!checkFilter(f, block)) {
            return false;
          }
        }
      }
      return true;
    case 'any':
      if (Array.isArray(value)) {
        for (const f of value as Filter[]) {
          if (checkFilter(f, block)) {
            return true;
          }
        }
      }
      return false;
  }
  return false;
}

export interface Query {
  // start with / for regex
  '?values'?: string[];
  '?filter'?: Filter;
  // key is normal node name or regex
  [key: string]: Query | unknown;
}

function isQuery(val: any): val is Query {
  return val && typeof val === 'object' && (val['?values'] == null || Array.isArray(val['?values']));
}

export function queryBlock(block: Block, query: Query | unknown) {
  if (isQuery(query)) {
    if (query['?filter']) {
      if (!checkFilter(query['?filter'], block)) {
        return undefined;
      }
    }
    const result: DataMap = {};
    if (Array.isArray(query['?values'])) {
      for (const field of query['?values'] as string[]) {
        if (typeof field === 'string') {
          switch (field.charAt(0)) {
            case '/': // RegExp
              const regex = toRegex(field);
              block.forEach((name, prop) => {
                if (regex.test(name)) {
                  result[name] = block.getValue(name);
                }
              });
              break;
            default:
              const value = block.getValue(field);
              if (value !== undefined) {
                result[field] = value;
              }
          }
        }
      }
    }
    for (const key in query) {
      switch (key.charAt(0)) {
        case '?': // ignore
          break;
        case '/': {
          // RegExp
          const regex = toRegex(key);
          block.forEach((name, prop) => {
            if (regex.test(name) && prop._value instanceof Block) {
              const value = queryBlock(prop._value, query[key]);
              if (value !== undefined) {
                result[name] = value;
              }
            }
          });
          break;
        }
        default: // other children
          const child = block.getValue(key);
          if (child instanceof Block) {
            const value = queryBlock(child, query[key]);
            if (value !== undefined) {
              result[key] = value;
            }
          }
      }
    }
    return result;
  }
}
