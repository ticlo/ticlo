import {BlockProperty} from './BlockProperty';
import {DataMap} from '../util/DataTypes';

export const MAX_GROUP_LENGTH = 256;

export interface FunctionOutput {
  // field is '#output' by default
  output(value: unknown, field?: string): void;
}

export interface FunctionInput {
  getValue(field: string): unknown;

  getOptionalProps(): string[];
}

export interface FunctionData extends FunctionInput, FunctionOutput {
  // get the property when it's a block, otherwise return null
  getProperty(field: string, create: boolean): BlockProperty;
  // emit output event
  emit(val: unknown): void;
}

export class DataWrapper implements FunctionData {
  readonly outputs: DataMap = {};
  constructor(public readonly inputs: DataMap) {}

  getOptionalProps(): string[] {
    return [];
  }

  getValue(field: string): unknown {
    return this.inputs[field];
  }

  output(value: unknown, field?: string): void {
    this.outputs[field] = value;
  }
  getProperty(field: string, create: boolean): BlockProperty {
    return null;
  }
  emit(val: unknown): void {}
}

export function getInputsLength(input: FunctionInput, group?: string, defaultLength = 2, maxLength = MAX_GROUP_LENGTH) {
  let result = input.getValue(`${group}[]`);
  if (Array.isArray(result)) {
    return 0;
  }
  let realMaxLength = Number.isInteger(maxLength) ? maxLength : MAX_GROUP_LENGTH;
  if ((result as number) >= 0) {
    if ((result as number) <= realMaxLength) {
      return Number(result);
    }
    return realMaxLength;
  }
  return defaultLength;
}

export function getInputsArray(
  input: FunctionInput,
  group = '',
  defaultLength = 2,
  fields?: string[],
  maxLength = MAX_GROUP_LENGTH
): unknown[] {
  let lenOrArray = input.getValue(`${group}[]`);
  if (Array.isArray(lenOrArray)) {
    // iterate native array
    return lenOrArray;
  }
  let len: number;
  if ((lenOrArray as number) >= 0) {
    len = Number(lenOrArray);
    let realMaxLength = Number.isInteger(maxLength) ? maxLength : MAX_GROUP_LENGTH;
    if (len > realMaxLength) {
      len = realMaxLength;
    }
  } else {
    len = defaultLength;
  }
  let result: unknown[] = [];
  if (len >= 0 && fields) {
    // iterate block array with fields
    for (let i = 0; i < len; ++i) {
      // return object structure
      let obj: DataMap = {};
      for (let field of fields) {
        obj[field] = input.getValue(`${field}${i}`);
      }
      result.push(obj);
    }
  } else {
    // iterate default block array
    for (let i = 0; i < len; ++i) {
      result.push(input.getValue(`${group}${i}`));
    }
  }
  return result;
}
