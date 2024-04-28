import {DateTime} from 'luxon';

type Validator = (v: unknown, root?: unknown) => boolean;
type ValidatorDynamic = Validator | {[key: string]: ValidatorDynamic} | ValidatorDynamic[] | string | number;

function checkDynamic(value: unknown, validator: ValidatorDynamic, root: unknown) {
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
  validator: {[key: string]: ValidatorDynamic},
  root?: unknown
): value is object {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  for (const key of Object.keys(validator)) {
    if (!checkDynamic(value[key], validator[key], root)) {
      return false;
    }
  }
  return true;
}
// if validator length is 1, it's applied to all children
// if validator size is 0, it only checks if value is Array
function checkA(value: unknown, validator: ValidatorDynamic[], root?: unknown): value is unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  if (validator.length === 1) {
    const v = validator[0];
    for (const val of value) {
      if (!checkDynamic(val, v, root)) {
        return false;
      }
    }
  } else {
    for (let i = 0; i < validator.length; ++i) {
      if (!checkDynamic(value[i], validator[i], root)) {
        return false;
      }
    }
  }
  return true;
}

function enumValidator(enums: readonly string[]) {
  return (value: unknown) => enums.includes(value as string);
}
// match validator or null
function nullableValidator(validator: ValidatorDynamic) {
  return (value: unknown, root: unknown) => value == null || checkDynamic(value, validator, root);
}
// match any of the validators
function anyValidator(...validators: ValidatorDynamic[]) {
  return (value: unknown, root: unknown) =>
    validators.find((validator: ValidatorDynamic) => checkDynamic(value, validator, root)) !== undefined;
}

function conditionValidator(condition: (root: any) => boolean, validator: ValidatorDynamic) {
  return (value: unknown, root: unknown) => {
    if (condition(root)) {
      return checkDynamic(value, validator, root);
    }
    return value == null;
  };
}

function switchValidator(validator: {[key: string]: ValidatorDynamic}) {
  return (value: string, root: unknown) => {
    if (validator.hasOwnProperty(value)) {
      return checkDynamic(root, validator[value], root);
    }
    return false;
  };
}

function emptyArrayValidator(validator: ValidatorDynamic) {
  return (value: string, root: unknown) => {
    if (!Array.isArray(value)) {
      return false;
    }
    for (const val of value) {
      if (!checkDynamic(val, validator, root)) {
        return false;
      }
    }
    return true;
  };
}

function number0toN(max: number) {
  return (value: unknown): value is number =>
    Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;
}
function number1toN(max: number) {
  return (value: unknown): value is number =>
    Number.isInteger(value) && (value as number) >= 1 && (value as number) <= max;
}

function check(value: unknown, validator: ValidatorDynamic) {
  return checkDynamic(value, validator, value);
}

const Validator = {
  check,
  checkO,
  checkA,
  array0: emptyArrayValidator,
  nullable: nullableValidator,
  any: anyValidator,
  enum: enumValidator,
  datetime: DateTime.isDateTime,
  int: Number.isInteger,
  notNegative: (value: unknown) => typeof value === 'number' && value >= 0,
  num0n: number0toN,
  num1n: number1toN,
  condition: conditionValidator,
  switch: switchValidator,
};

export default Validator;
