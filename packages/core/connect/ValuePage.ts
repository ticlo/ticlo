import {deepEqualTransport} from '../util/TransportValue.ts';

export interface ValueReadOptions {
  select?: readonly (string | number)[];
}

export interface ValuePageOptions extends ValueReadOptions {
  offset: number;
  limit: number;
  anchor?: unknown;
}

export type ValuePage<T = unknown> = {
  items: T[];
  offset: number;
  total: number;
  keys?: string[];
};

function isObjectRow(value: unknown): value is Record<string, unknown> {
  return value != null && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/** Read a complete array slice. The caller checks access to the owning property. */
// REFACTOR(design.md): MUST validate the transport anchor against retained data and materialize only the requested slice.
export function readValuePage(value: unknown, {offset, limit, anchor}: ValuePageOptions): ValuePage | string {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1)
    return 'invalid page range';
  if (value === undefined) value = [];
  if (!Array.isArray(value)) return 'value is not an array';
  if (offset > value.length || (offset > 0 && !deepEqualTransport(value[offset - 1], anchor)))
    return 'page_anchor_mismatch';
  const items = value.slice(offset, offset + limit);
  const result: ValuePage = {items, offset, total: value.length};
  if (offset === 0 && items.length < value.length && isObjectRow(value[0]) && isObjectRow(value.at(-1))) {
    result.keys = [...new Set([...Object.keys(value[0]), ...Object.keys(value.at(-1))])];
  }
  return result;
}
