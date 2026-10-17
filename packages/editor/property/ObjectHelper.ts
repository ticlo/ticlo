import {type DataMap, type FunctionDesc, type PropDesc, getDefaultFuncData, getSubBlockFuncData} from '@ticlo/core';
import {isSavedBlock} from '@ticlo/core/util/DataTypes.ts';
import {validateNodePath} from '@ticlo/core/util/Path.ts';

const savedValue = (value: unknown) => (isSavedBlock(value) ? {'#is': value} : value);

export function getObjectHelperData(desc: FunctionDesc, value: DataMap, optional: Record<string, PropDesc>): DataMap {
  const data = getSubBlockFuncData(getDefaultFuncData(desc));
  if (desc.recipient) {
    data[desc.recipient] = savedValue(value);
    return data;
  }

  const optionalNames: string[] = [];
  const custom: PropDesc[] = [];
  const extend = {...value};
  for (const [name, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    if (Object.hasOwn(optional, name)) {
      optionalNames.push(name);
    } else if (!desc.optional && name && !/^[#~@+]/.test(name) && !name.endsWith('[]') && validateNodePath(name)) {
      custom.push({name, type: 'any'});
    } else {
      continue;
    }
    data[name] = savedValue(entry);
    delete extend[name];
  }
  if (optionalNames.length) data['#optional'] = optionalNames;
  if (custom.length) data['#custom'] = custom;
  data['@b-p'] = [...(data['@b-p'] as string[]), ...optionalNames, ...custom.map((prop) => prop.name)];
  if (Object.keys(extend).length) data['#extend'] = savedValue(extend);
  return data;
}
