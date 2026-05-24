import {Block} from '../block/Block.js';
import {DataMap, isDataMap} from '../util/DataTypes.js';
import {BlockProperty} from '../block/BlockProperty.js';
import {FlowWithStatic, StaticBlock, StaticConfig} from '../block/StaticBlock.js';
import {findPropertyForNewBlock} from './PropertyName.js';
import {Flow} from '../block/Flow.js';
import {addMapArray} from '../util/Map.js';
import {cloneToLevel} from '../util/Clone.js';

function getProperty(parent: Block, field: string, create = false): [BlockProperty, Block] {
  if (field.startsWith('#static.')) {
    const staticBlock = parent.getValue('#static');
    if (staticBlock instanceof Block) {
      return [staticBlock.getProperty(field.substring(8)), staticBlock];
    } else {
      return [null, null];
    }
  } else {
    return [parent.getProperty(field), null];
  }
}
export function createStaticBlock(property: BlockProperty): StaticBlock {
  if (property instanceof StaticConfig) {
    const value = property._value;
    if (value instanceof StaticBlock) {
      return value;
    }
    const flow = property._block as FlowWithStatic;
    return StaticBlock.loadStaticBlock(flow, flow._loadFrom, {});
  }
  return null;
}
export function copyProperties(parent: Block, fields: string[]): DataMap | string {
  const result: any = {};
  let staticResult: any;
  for (const field of fields) {
    const [prop, staticBlock] = getProperty(parent, field);

    if (prop) {
      if (staticBlock) {
        if (!staticResult) {
          staticResult = {};
          result['#static'] = staticResult;
        }
        prop._saveToMap(staticResult);
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
  for (const field of fields) {
    const [prop] = getProperty(parent, field);
    if (prop) {
      prop.setValue(undefined);
    }
  }
}

export function pasteProperties(parent: Block, data: DataMap, resolve?: 'overwrite' | 'rename'): string | string[] {
  if (!data || typeof data !== 'object' || data.constructor !== Object) {
    return 'invalid data';
  }

  // #static content is pasted into the attached static block, while all other
  // fields are pasted into the selected parent block.
  let {'#static': staticValue, ...others} = data;
  others = cloneToLevel(others, 3);
  const staticData = cloneToLevel(staticValue, 3) as DataMap;

  const staticBlock = createStaticBlock(parent.getProperty('#static', staticData != null));

  if (resolve !== 'overwrite') {
    const existingBlocks: string[] = [];
    const existingStaticBlocks: string[] = [];
    for (const field in others) {
      if (parent.getProperty(field, false)?._saved instanceof Block) {
        existingBlocks.push(field);
      }
    }
    if (staticData && staticBlock) {
      // ignore the static block not allowed error here, handle it later
      for (const field in staticData) {
        if (staticBlock.getProperty(field, false)?._saved instanceof Block) {
          existingStaticBlocks.push(field);
        }
      }
    }
    if (existingBlocks.length || existingStaticBlocks.length) {
      if (resolve === 'rename') {
        if (existingBlocks.length) {
          renameBlocks(parent, others, existingBlocks);
        }
        if (existingStaticBlocks.length) {
          renameBlocks(staticBlock, staticData, existingStaticBlocks);
        }
      } else {
        if (existingBlocks.length) {
          return `block already exists: ${existingBlocks.join(',')},${existingStaticBlocks
            .map((field) => `#static.${field}`)
            .join(',')}`;
        }
      }
    }
  }

  let positions = collectBlockPositions(parent);
  if (staticBlock) {
    positions = new Map([...positions, ...collectBlockPositions(staticBlock)]);
  }
  moveBlockPositions(others, staticData, positions);

  if (staticData) {
    if (staticBlock == null) {
      return '#static properties not allowed in this Block';
    }
    staticBlock._liveUpdate(staticData, false);
  }
  parent._liveUpdate(others, false);

  let result = [...Object.keys(others)];
  if (staticData) {
    result = [...result, ...Object.keys(staticData).map((name: string) => `#static.${name}`)];
  }

  return result;
}

function isParentBinding(str: string) {
  return str === '##';
}

function renameBlocks(parent: Block, data: DataMap, fields: string[]) {
  const map: Map<string, string> = new Map();
  const reservedNames: string[] = [];
  // move blocks
  for (const field of fields) {
    const newField = findPropertyForNewBlock(parent, field, reservedNames)._name;
    map.set(field, newField);
    reservedNames.push(newField);
    data[newField] = data[field];
    delete data[field];
  }
  const isFlow = parent instanceof Flow;
  // move bindings
  function moveBinding(obj: DataMap, level: number) {
    for (const key in obj) {
      const val = obj[key];
      if (key.startsWith('~') && typeof val === 'string') {
        const parts = val.split('.');
        if (isFlow && parts[0] === '#flow' && fields.includes(parts[1])) {
          // flow binding
          parts[1] = map.get(parts[1]);
          obj[key] = parts.join('.');
        } else if (fields.includes(parts[level]) && parts.slice(0, level).every(isParentBinding)) {
          parts[level] = map.get(parts[level]);
          obj[key] = parts.join('.');
        }
      } else if (isDataMap(val)) {
        moveBinding(val, level + 1);
      }
    }
  }
  moveBinding(data, 0);
  // move synced parent block
  for (const key in data) {
    const val = data[key];
    if (isDataMap(val)) {
      const xyw = val['@b-xyw'];
      if (typeof xyw === 'string' && fields.includes(xyw)) {
        val['@b-xyw'] = map.get(xyw);
      }
    }
  }
}

function collectBlockPositions(parent: Block): Map<number, number[]> {
  const result: Map<number, number[]> = new Map();
  parent.forEach((key: string, value: unknown, prop) => {
    if (prop._saved instanceof Block) {
      const xyw = prop._saved.getValue('@b-xyw');
      if (Array.isArray(xyw) && typeof xyw[0] === 'number' && typeof xyw[1] === 'number') {
        addMapArray(result, xyw[0], xyw[1]);
      }
    }
  });
  return result;
}

function moveBlockPositions(data0: DataMap, data1: DataMap, positions: Map<number, number[]>) {
  const xyws: number[][] = [];
  function collectDataPosition(data: DataMap) {
    for (const key in data) {
      const value = data[key];
      if (isDataMap(value)) {
        const xyw = value['@b-xyw'];
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
  // eslint-disable-next-line no-constant-condition
  nextoffset: for (; true; offset += 24) {
    for (const xyw of xyws) {
      const x = xyw[0] + offset;
      // find a range of y that we don't want to see another block
      const ylow = xyw[1] + offset - 80;
      const yhigh = ylow + 160;
      const ys = positions.get(x);
      if (ys) {
        for (const y of ys) {
          if (y > ylow && y < yhigh) {
            continue nextoffset;
          }
        }
      }
    }
    break;
  }
  if (offset > 0) {
    for (const xyw of xyws) {
      xyw[0] += offset;
      xyw[1] += offset;
    }
  }
}
