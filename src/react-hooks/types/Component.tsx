import React, {ComponentType, ReactNode, useEffect, useMemo, useReducer, useState} from 'react';
import {type Block, FunctionDesc, Functions, PropDesc} from '@ticlo/core';
import {FunctionClass} from '@ticlo/core/block/BlockFunction';
import {PropMap} from './PropType';

interface ReactComponentProperties {
  block: Block;
}

const componentsMap = new Map<string, ComponentType<ReactComponentProperties>>();
const containerFuncIds = new Set<string>();

export function registerComponent(
  component: ComponentType<ReactComponentProperties>,
  name: string,
  propertyMap: PropMap,
  namespace: string = 'react-component',
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
    containerFuncIds.add(`${namespace}:${name}`);
    // class ContainerFunction extends ConditionalWorkersFunction {}
    // functionClass = ContainerFunction;
    // for (let p of ConditionalWorkersFunctionProperties) {
    //   properties.push(p);
    // }
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

export function TicloFuncComp({block}: {block: Block}) {
  const [functionId, setFunctionId] = useState(block.getValue('#is') as string);
  const listener = useMemo(() => ({onChange: setFunctionId, onSourceChange: () => {}}), []);
  useEffect(() => {
    const propIs = block.getProperty('#is', true);
    propIs.listen(listener);
    return () => propIs.unlisten(listener);
  }, []);
  const C = componentsMap.get(functionId);
  if (C) {
    return <C block={block} key={block.getName()} />;
  }
  return null;
}

export function renderChildren(blocks: Block[]) {
  const result: ReactNode[] = [];
  for (const block of blocks) {
    result.push(<TicloFuncComp block={block} key={block._blockId} />);
  }
  return result;
}

export function findComponent(funcId: string) {
  return componentsMap.get(funcId);
}

export function isContainerFunction(funcId: unknown) {
  return typeof funcId === 'string' && containerFuncIds.has(funcId);
}
