import {Block} from '../block/Block.js';
import {BlockProperty} from '../block/BlockProperty.js';
import {configDescs, FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor.js';
import {Functions} from '../block/Functions.js';
import {configList} from './PropertyShowHide.js';
import {PropertyMover} from './PropertyMover.js';

const trailingNumberReg = /\d+$/;

const cachedReserveTable = new WeakMap<any, [Set<string>, string[]]>();

function collectNames(props: (PropDesc | PropGroupDesc)[]) {
  if (!Array.isArray(props)) {
    return [];
  }

  const usedNames: string[] = [];
  const groupNames: string[] = [];

  for (const propDesc of props) {
    if (propDesc.type === 'group') {
      const lenField = `${propDesc.name}[]`;
      usedNames.push(lenField);
      for (const childDesc of (propDesc as PropGroupDesc).properties) {
        groupNames.push(childDesc.name);
      }
    } else {
      usedNames.push(propDesc.name);
    }
  }
  return [usedNames, groupNames];
}

function getReservedNames(funcId: unknown): [Set<string>, string[]] {
  let desc: FunctionDesc;
  if (typeof funcId === 'string') {
    [desc] = Functions.getDescToSend(funcId);
  }
  if (cachedReserveTable.has(desc)) {
    return cachedReserveTable.get(desc);
  }

  if (desc) {
    const [usedNames0, groupNames0] = collectNames(desc.properties);
    const [usedNames1, groupNames1] = collectNames(Object.values(desc.optional));
    let baseUsedNames: Set<string>;
    let baseGroupNames: string[];
    if (desc.base) {
      [baseUsedNames, baseGroupNames] = getReservedNames(desc.base);
    }
    const result = [
      // use Set to improve performance
      new Set([...configList, ...baseUsedNames, ...(usedNames0 ?? []), ...(usedNames1 ?? [])]),
      // small Array is faster than Set, but we still need to remove duplicates with Set
      [...new Set([...baseGroupNames, ...(groupNames0 ?? []), ...(groupNames1 ?? [])]).values()],
    ] as [Set<string>, string[]];
    cachedReserveTable.set(desc, result);
    return result;
  }
  return [new Set(), []];
}

export function findPropertyForNewBlock(block: Block, baseName: string, reservedNames?: string[]): BlockProperty {
  const [usedNames, groupNames] = getReservedNames(block.getValue('#is')?.toString());
  const [customUsedNames, customGroupNames] = collectNames(block.getValue('#custom') as (PropDesc | PropGroupDesc)[]);

  const isNameUsed = (name: string) => {
    return usedNames.has(name) || customUsedNames?.includes(name) || reservedNames?.includes(name);
  };
  const isNameInGroup = (name: string) => {
    return groupNames.includes(name) || customGroupNames?.includes(name);
  };

  // base name without trailing number
  let baseName0 = baseName.replace(trailingNumberReg, '');
  if (isNameInGroup(baseName0)) {
    baseName0 += '_';
  } else if (!isNameUsed(baseName0)) {
    const p = block.getProperty(baseName0);
    if (p.isCleared()) {
      return p;
    }
  }
  for (let i = 1; ; ++i) {
    const newName = `${baseName0}${i}`;
    if (!isNameUsed(newName)) {
      const p = block.getProperty(newName);
      if (p.isCleared()) {
        return p;
      }
    }
  }
}

export function renameProperty(block: Block, oldName: string, newName: string, moveOutboundLinks = false) {
  new PropertyMover(block, oldName, moveOutboundLinks).moveTo(newName);
}
