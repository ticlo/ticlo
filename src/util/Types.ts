export interface DataMap {
  [key: string]: any;
}

export function isSavedBlock(val: any): boolean {
  return val instanceof Object && val != null
    && (val.hasOwnProperty('#class') || val.hasOwnProperty('~#class'));
}