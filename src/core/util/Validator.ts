import {DateTime} from 'luxon';

type Validator = (v: unknown, root?: unknown) => boolean;
type ValidatorAny = Validator | {[key: string]: ValidatorAny} | ValidatorAny[] | string | number;

function checkAny(value: unknown, validator: ValidatorAny, root: unknown) {
  switch (typeof validator) {
    case 'function':
      return validator(value, root);
    case 'object':
      if (Array.isArray(validator)) {
        return checkA(value, validator, root);
      }
      return checkO(value, validator, root);
    case 'string':
      return typeof value === validator;
    case 'number':
      return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= validator;
  }
}
function checkO(
  value: {[key: string]: any},
  validator: {[key: string]: ValidatorAny},
  root?: unknown
): value is object {
  if (typeof value !== 'object' || value == null) {
    return false;
  }
  for (const key of Object.keys(validator)) {
    if (!checkAny(value[key], validator[key], root)) {
      return false;
    }
  }
  return true;
}
// if validator length is 1, it's applied to all children
// if validator size is 0, it only checks if value is Array
function checkA(value: unknown, validator: ValidatorAny[], root?: unknown): value is unknown[] {
  if (!Array.isArray(value)) {
    return false;
  }
  if (validator.length === 1) {
    const v = validator[0];
    for (const val of value) {
      if (!checkAny(val, v, root)) {
        return false;
      }
    }
  } else {
    for (let i = 0; i < validator.length; ++i) {
      if (!checkAny(value[i], validator[i], root)) {
        return false;
      }
    }
  }
  return true;
}

function enumValidator(enums: readonly string[]) {
  return (value: unknown) => enums.includes(value as string);
}

function nullableValidator(validator: ValidatorAny) {
  return (value: unknown, root: unknown) => value == null || checkAny(value, validator, root);
}

function number0toN(max: number) {
  return (value: unknown): value is number =>
    Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;
}
function number1toN(max: number) {
  return (value: unknown): value is number =>
    Number.isInteger(value) && (value as number) >= 1 && (value as number) <= max;
}

function check(value: unknown, validator: ValidatorAny) {
  return checkAny(value, validator, value);
}

const Validator = {
  check,
  obj: checkO,
  array: checkA,
  nullable: nullableValidator,
  enum: enumValidator,
  datetime: DateTime.isDateTime,
  int: Number.isInteger,
  notNegative: (value: unknown) => typeof value === 'number' && value >= 0,
  num0n: number0toN,
  num1n: number1toN,
};

export default Validator;
