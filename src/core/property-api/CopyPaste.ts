import {Block} from '../block/Block';
import {DataMap} from '../util/DataTypes';
import {BlockProperty} from '../block/BlockProperty';
import {JobWithShared, SharedBlock, SharedConfig} from '../block/SharedBlock';

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

export function pasteProperties(parent: Block, data: DataMap, overwrite = true): string {
  if (!data || typeof data !== 'object' || data.constructor !== Object) {
    return 'invalid data';
  }

  let {'#shared': sharedData, ...others} = data;

  if (!overwrite) {
    let existingBlocks: string[] = [];
    for (let field in others) {
      if (parent.getProperty(field, false)?._saved instanceof Block) {
        existingBlocks.push(field);
      }
    }
    if (sharedData) {
      let sharedBlock: SharedBlock = createSharedBlock(parent.getProperty('#shared'));
      for (let field in sharedData) {
        if (sharedBlock.getProperty(field, false)?._saved instanceof Block) {
          existingBlocks.push(`#shared.${field}`);
        }
      }
    }
    if (existingBlocks.length) {
      return `block already exists on: ${existingBlocks.join(',')}`;
    }
  }

  if (sharedData) {
    let sharedBlock: SharedBlock = createSharedBlock(parent.getProperty('#shared'));

    if (sharedBlock == null) {
      return '#shared properties not allowed in this Block';
    }
    sharedBlock._liveUpdate(sharedData, false);
  }
  parent._liveUpdate(others, false);
}
