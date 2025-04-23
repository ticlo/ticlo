import React, {ComponentType, ReactNode} from 'react';
import {type Block, FunctionDesc, Functions, PropDesc} from '@ticlo/core';
import {MultiWorkerFunction, MultiWorkerFunctionProperties} from '@ticlo/core/worker/MultiWorkerFunction';
import {FunctionClass} from '@ticlo/core/block/BlockFunction';
import {PropMap} from './PropType';

interface ReactComponentProperties {
  block: Block;
}

const componentsMap = new Map<string, ComponentType<ReactComponentProperties>>();

export function registerComponent(
  component: ComponentType<ReactComponentProperties>,
  name: string,
  propertyMap: PropMap,
  namespace?: string,
  funcDesc?: Partial<FunctionDesc>,
  isContainer = false
) {
  let properties: PropDesc[] = [];
  for (let key of Object.keys(propertyMap)) {
    let {value, ...rest} = propertyMap[key];
    properties.push({...value.desc, ...rest, name: key});
  }
  let functionClass: FunctionClass | null = null;
  if (isContainer) {
    class ContainerFunction extends MultiWorkerFunction {}
    functionClass = ContainerFunction;
    for (let p of MultiWorkerFunctionProperties) {
      properties.push(p);
    }
  }

  Functions.add(
    functionClass,
    {
      name,
      color: '09d',
      icon: 'fas:dice-d6',
      ...funcDesc,
      properties,
      configs: isContainer ? [{name: '#children', type: 'array'}] : undefined,
    },
    namespace
  );

  const key = namespace ? `${namespace}:${name}` : name;
  componentsMap.set(key, component);
}

export function renderComponent(block: Block) {
  const C = componentsMap.get(block.getValue('#is') as string);
  if (C) {
    return <C block={block} key={block.getName()} />;
  }
  return null;
}

export function renderChildren(blocks: Block[]) {
  const result: ReactNode[] = [];
  for (const block of blocks) {
    result.push(renderComponent(block));
  }
  return result;
}

export function findComponent(funcId: string) {
  return componentsMap.get(funcId);
}
