import {Block} from '../block/Block';
import {DataMap} from '../util/DataTypes';
import {BlockProperty} from '../block/BlockProperty';
import {FlowWithShared, SharedBlock, SharedConfig} from '../block/SharedBlock';
import {findPropertyForNewBlock} from './PropertyName';
import {Flow} from '../block/Flow';
import {addMapArray} from '../util/Map';
import {off} from 'codemirror';
import {cloneToLevel} from '../util/Clone';

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
    let job = property._block as FlowWithShared;
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

export function pasteProperties(parent: Block, data: DataMap, resolve?: 'overwrite' | 'rename'): string | string[] {
  if (!data || typeof data !== 'object' || data.constructor !== Object) {
    return 'invalid data';
  }

  let {'#shared': sharedData, ...others} = data;
  others = cloneToLevel(others, 3);
  sharedData = cloneToLevel(sharedData, 3);

  let sharedBlock = createSharedBlock(parent.getProperty('#shared', sharedData != null));

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

  let positions = collectBlockPositions(parent);
  if (sharedBlock) {
    positions = new Map([...positions, ...collectBlockPositions(sharedBlock)]);
  }
  moveBlockPositions(others, sharedData, positions);

  if (sharedData) {
    if (sharedBlock == null) {
      return '#shared properties not allowed in this Block';
    }
    sharedBlock._liveUpdate(sharedData, false);
  }
  parent._liveUpdate(others, false);

  let result = [...Object.keys(others)];
  if (sharedData) {
    result = [...result, ...Object.keys(sharedData).map((name: string) => `#shared.${name}`)];
  }

  return result;
}

function isParentBinding(str: string) {
  return str === '##';
}

function renameBlocks(parent: Block, data: DataMap, fields: string[]) {
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
  let isFlow = parent instanceof Flow;
  // move bindings
  function moveBinding(obj: DataMap, level: number) {
    for (let key in obj) {
      let val = obj[key];
      if (key.startsWith('~') && typeof val === 'string') {
        let parts = val.split('.');
        if (isFlow && parts[0] === '###' && fields.includes(parts[1])) {
          // job binding
          parts[1] = map.get(parts[1]);
          obj[key] = parts.join('.');
        } else if (fields.includes(parts[level]) && parts.slice(0, level).every(isParentBinding)) {
          parts[level] = map.get(parts[level]);
          obj[key] = parts.join('.');
        }
      } else if (val != null && val.constructor === Object) {
        moveBinding(val, level + 1);
      }
    }
  }
  moveBinding(data, 0);
  // move synced parent block
  for (let key in data) {
    let val = data[key];
    if (val != null && val.constructor === Object) {
      let xyw = val['@b-xyw'];
      if (typeof xyw === 'string' && fields.includes(xyw)) {
        val['@b-xyw'] = map.get(xyw);
      }
    }
  }
}

function collectBlockPositions(parent: Block): Map<number, number[]> {
  let result: Map<number, number[]> = new Map();
  parent.forEach((key: string, prop) => {
    if (prop._saved instanceof Block) {
      let xyw = prop._saved.getValue('@b-xyw');
      if (Array.isArray(xyw) && typeof xyw[0] === 'number' && typeof xyw[1] === 'number') {
        addMapArray(result, xyw[0], xyw[1]);
      }
    }
  });
  return result;
}

function moveBlockPositions(data0: DataMap, data1: DataMap, positions: Map<number, number[]>) {
  let xyws: number[][] = [];
  function collectDataPosition(data: DataMap) {
    for (let key in data) {
      let value = data[key];
      if (value != null && value.constructor === Object) {
        let xyw = value['@b-xyw'];
        if (Array.isArray(xyw) && typeof xyw[0] === 'number' && typeof xyw[1] === 'number') {
          xyws.push(xyw);
        }
      }
    }
  }
  // collection position in data
  collectDataPosition(data0);
  if (data1) {
    collectDataPosition(data1);
  }

  // check block overlap and move positions
  let offset = 0;
  nextoffset: for (; true; offset += 24) {
    for (let xyw of xyws) {
      let x = xyw[0] + offset;
      // find a range of y that we dont want to see another block
      let ylow = xyw[1] + offset - 80;
      let yhigh = ylow + 160;
      let ys = positions.get(x);
      if (ys) {
        for (let y of ys) {
          if (y > ylow && y < yhigh) {
            continue nextoffset;
          }
        }
      }
    }
    break;
  }
  if (offset > 0) {
    for (let xyw of xyws) {
      xyw[0] += offset;
      xyw[1] += offset;
    }
  }
}
