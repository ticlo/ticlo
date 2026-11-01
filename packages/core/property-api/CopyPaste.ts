import {Block} from '../block/Block.ts';
import {DataMap, isDataMap, isSavedBlock} from '../util/DataTypes.ts';
import {BlockProperty} from '../block/BlockProperty.ts';
import {FlowWithStatic, StaticBlock, StaticConfig} from '../block/StaticBlock.ts';
import {findPropertyForNewBlock} from './PropertyName.ts';
import {Flow} from '../block/Flow.ts';
import {addMapArray} from '../util/Map.ts';
import {deepClone} from '../util/Clone.ts';

function blockPath(parent: Block): string[] {
  const path: string[] = [];
  for (let block = parent; block._parent && block._parent !== block; block = block._parent) {
    path.unshift(block._prop._name);
  }
  path.unshift('');
  return path;
}

function getProperty(parent: Block, field: string, create = false): [BlockProperty, Block] {
  if (field.startsWith('#static.')) {
    const staticBlock = parent.getValue('#static');
    if (staticBlock instanceof Block) {
      return [staticBlock.getProperty(field.substring(8), create), staticBlock];
    } else {
      return [null, null];
    }
  } else {
    return [parent.getProperty(field, create), null];
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
          staticResult['#_copy_from'] = staticBlock.getFullPath();
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
  result['#_copy_from'] = parent.getFullPath();
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
  return pastePropertiesImpl(parent, data, resolve);
}

export function moveBlocks(
  source: Block,
  target: Block,
  fields: string[],
  resolve?: 'overwrite' | 'rename',
  renames?: Map<string, string>
): string | string[] {
  if (source === target) return 'source and target parents must be different';
  for (const field of fields) {
    const [prop] = getProperty(source, field);
    const block = prop?._saved;
    if (!(block instanceof Block) || block._prop !== prop || block instanceof Flow) return 'invalid block';
    for (let parent = target; parent; parent = parent._parent) {
      if (parent === block) return 'cannot move blocks into their descendants';
      if (parent._parent === parent) break;
    }
  }
  const data = copyProperties(source, fields);
  if (typeof data === 'string') return data;
  return pastePropertiesImpl(target, data, resolve, () => deleteProperties(source, fields), renames);
}

function pastePropertiesImpl(
  parent: Block,
  data: DataMap,
  resolve?: 'overwrite' | 'rename',
  beforePaste?: () => void,
  renames?: Map<string, string>
): string | string[] {
  if (!data || typeof data !== 'object' || data.constructor !== Object) {
    return 'invalid data';
  }

  // #static content is pasted into the attached static block, while all other
  // fields are pasted into the selected parent block.
  let {'#static': staticValue, '#_copy_from': sourcePath, ...others} = data;
  others = deepClone(others);
  const staticData = deepClone(staticValue) as DataMap;
  const staticSourcePath = staticData?.['#_copy_from'];
  if (staticData) delete staticData['#_copy_from'];

  const staticBlock = createStaticBlock(parent.getProperty('#static', staticData != null));

  adjustParentBindings(parent, others, sourcePath, staticData);
  if (staticBlock && staticData) adjustParentBindings(staticBlock, staticData, staticSourcePath);

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
          renameBlocks(parent, others, existingBlocks, renames);
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

  if (staticData && staticBlock == null) return '#static properties not allowed in this Block';
  // Moves delete their sources only after validating the complete paste.
  beforePaste?.();
  if (staticData) {
    staticBlock._liveUpdate(staticData, false);
  }
  parent._liveUpdate(others, false);

  let result = [...Object.keys(others)];
  if (staticData) {
    result = [...result, ...Object.keys(staticData).map((name: string) => `#static.${name}`)];
  }

  return result;
}

function adjustParentBindings(parent: Block, data: DataMap, sourcePath: unknown, staticData?: DataMap) {
  if (typeof sourcePath !== 'string') return;
  const flow = parent._flow;
  const flowPath = flow.getFullPath();
  let sourceParent: unknown;
  if (sourcePath === flowPath) {
    sourceParent = flow;
  } else if (!flowPath || sourcePath.startsWith(`${flowPath}.`)) {
    sourceParent = flow.queryValue(flowPath ? sourcePath.substring(flowPath.length + 1) : sourcePath);
  }
  if (!(sourceParent instanceof Block) || sourceParent._flow !== flow) return;
  const source = blockPath(sourceParent);
  const targetPath = blockPath(parent);
  const depthChange = targetPath.length - source.length;
  if (depthChange === 0) return;
  const fields = Object.keys(data).map((key) =>
    key.startsWith('~') && typeof data[key] === 'string' ? key.substring(1) : key
  );
  if (staticData) fields.push(...Object.keys(staticData).map((key) => `#static.${key}`));
  const copiedPaths = fields.map((field) => source.concat(field.split('.')));
  const startsWith = (path: string[], prefix: string[]) => prefix.every((part, i) => path[i] === part);

  function adjust(blockData: DataMap, level: number) {
    for (const key in blockData) {
      const value = blockData[key];
      if (key.startsWith('~') && typeof value === 'string' && value.startsWith('##.')) {
        const parts = value.split('.');
        let count = 0;
        while (parts[count] === '##') ++count;
        if (count < level) continue; // The source stays inside a copied subtree.
        const ancestorLength = Math.max(1, source.length - (count - level));
        const ancestor = source.slice(0, ancestorLength);
        const bindingSource = ancestor.concat(parts.slice(count));
        if (copiedPaths.some((path) => startsWith(bindingSource, path))) continue;
        if (count + depthChange < level || !startsWith(targetPath, ancestor)) continue;
        const adjusted = Array(count + depthChange)
          .fill('##')
          .concat(parts.slice(count))
          .join('.');
        if (adjusted) blockData[key] = adjusted;
      } else if (isSavedBlock(value) && typeof value['#is'] !== 'object') {
        adjust(value, level + 1);
      }
    }
  }
  adjust(data, 0);
}

function isParentBinding(str: string) {
  return str === '##';
}

function renameBlocks(parent: Block, data: DataMap, fields: string[], map = new Map<string, string>()) {
  const reservedNames: string[] = Object.keys(data);
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
