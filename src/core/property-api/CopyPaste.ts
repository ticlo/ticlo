import {Block} from '../block/Block';
import {DataMap} from '../util/DataTypes';
import {BlockProperty} from '../block/BlockProperty';
import {JobWithShared, SharedBlock, SharedConfig} from '../block/SharedBlock';
import {findPropertyForNewBlock} from './PropertyName';
import {Job} from '../block/Job';

function getProperty(parent: Block, field: string, create = false): [BlockProperty, Block] {
  if (field.startsWith('#shared.')) {
    let sharedBlock = parent.getValue('#shared');
    if (sharedBlock instanceof Block) {
      return [sharedBlock.getProperty(field.substring(8)), sharedBlock];
    } else {
      return [null, sharedBlock];
    }
  } else {
    return [parent.getProperty(field), null];
  }
}
export function createSharedBlock(property: BlockProperty): SharedBlock {
  if (property instanceof SharedConfig) {
    let value = property._value;
    if (value instanceof SharedBlock) {
      return value;
    }
    let job = property._block as JobWithShared;
    return SharedBlock.loadSharedBlock(job, job._loadFrom, {});
  }
  return null;
}
export function copyProperties(parent: Block, fields: string[]): DataMap | string {
  let result: any = {};
  let sharedResult: any;
  for (let field of fields) {
    let [prop, sharedBlock] = getProperty(parent, field);

    if (prop) {
      if (sharedBlock) {
        if (!sharedResult) {
          sharedResult = {};
          result['#shared'] = sharedResult;
        }
        prop._saveToMap(sharedResult);
      } else {
        prop._saveToMap(result);
      }
    }
  }
  if (Object.keys(result).length === 0) {
    return 'nothing to copy';
  }
  return result;
}

export function deleteProperties(parent: Block, fields: string[]) {
  for (let field of fields) {
    let [prop] = getProperty(parent, field);
    if (prop) {
      prop.setValue(undefined);
    }
  }
}

export function pasteProperties(parent: Block, data: DataMap, resolve?: 'overwrite' | 'rename'): string {
  if (!data || typeof data !== 'object' || data.constructor !== Object) {
    return 'invalid data';
  }

  let {'#shared': sharedData, ...others} = data;

  let sharedBlock: SharedBlock;
  if (sharedData) {
    sharedBlock = createSharedBlock(parent.getProperty('#shared'));
  }

  if (resolve !== 'overwrite') {
    let existingBlocks: string[] = [];
    let existingSharedBlocks: string[] = [];
    for (let field in others) {
      if (parent.getProperty(field, false)?._saved instanceof Block) {
        existingBlocks.push(field);
      }
    }
    if (sharedData && sharedBlock) {
      // ignore the shared block not allowed error here, handle it later
      for (let field in sharedData) {
        if (sharedBlock.getProperty(field, false)?._saved instanceof Block) {
          existingSharedBlocks.push(field);
        }
      }
    }
    if (existingBlocks.length || existingSharedBlocks.length) {
      if (resolve === 'rename') {
        if (existingBlocks.length) {
          renameBlocks(parent, others, existingBlocks);
        }
        if (existingSharedBlocks.length) {
          renameBlocks(sharedBlock, sharedData, existingSharedBlocks);
        }
      } else {
        if (existingBlocks.length) {
          return `block already exists: ${existingBlocks.join(',')},${existingSharedBlocks
            .map((field) => `#shared.${field}`)
            .join(',')}`;
        }
      }
    }
  }

  if (sharedData) {
    if (sharedBlock == null) {
      return '#shared properties not allowed in this Block';
    }
    sharedBlock._liveUpdate(sharedData, false);
  }
  parent._liveUpdate(others, false);
}

function isParentBinding(str: string) {
  return str === '##';
}
function renameBlocks(parent: Block, data: DataMap, fields: string[]): Map<string, string> {
  let map: Map<string, string> = new Map();
  let reservedNames: string[] = [];
  // move blocks
  for (let field of fields) {
    let newField = findPropertyForNewBlock(parent, field, reservedNames)._name;
    map.set(field, newField);
    reservedNames.push(newField);
    data[newField] = data[field];
    delete data[field];
  }
  let isJob = parent instanceof Job;
  // move bindings
  function moveBinding(obj: DataMap, level: number) {
    for (let key in obj) {
      let val = obj[key];
      if (key.startsWith('~') && typeof val === 'string') {
        let parts = val.split('.');
        if (fields.includes(parts[level]) && parts.slice(0, level).every(isParentBinding)) {
          parts[level] = map.get(parts[level]);
          obj[key] = parts.join('.');
        }
      } else if (val != null && typeof val === 'object') {
        moveBinding(val, level + 1);
      }
    }
  }
  moveBinding(data, 0);
  return map;
}
