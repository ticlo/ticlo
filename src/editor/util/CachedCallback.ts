import {deepEqual} from '../../core/util/Compare';

// similar result as React.useMemo
export function cacheCall<InType, OutType>(
  callback: (input: InType) => OutType,
  validator?: (input: InType) => boolean,
  defaultResult?: OutType
): (input: InType) => OutType {
  let cachedInput: InType;
  let result: OutType = defaultResult;
  return (input: InType) => {
    if (!deepEqual(cachedInput, input)) {
      if (!validator || validator(input)) {
        cachedInput = input;
        result = callback(input);
      }
    }
    return result;
  };
}
