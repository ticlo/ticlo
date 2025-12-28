import React, {ComponentType, ReactNode, useEffect, useMemo, useReducer, useState} from 'react';
import {Block, FunctionDesc, Functions, PropDesc} from '@ticlo/core';
import {FunctionClass} from '@ticlo/core/block/BlockFunction.js';
import {PropMap} from './PropType.js';

interface BaseProps {
  block: Block;
}

const componentsMap = new Map<string, ComponentType<BaseProps>>();
const containerFuncIds = new Set<string>();

export function registerComponent<T extends BaseProps = BaseProps>(
  component: ComponentType<T>,
  name: string,
  propertyMap: PropMap,
  namespace: string = 'react-component',
  funcDesc?: Partial<FunctionDesc>,
  isContainer = false
) {
  const properties: PropDesc[] = [];
  for (const key of Object.keys(propertyMap)) {
    const {value, ...rest} = propertyMap[key];
    properties.push({...value.desc, ...rest, name: key});
  }
  const functionClass: FunctionClass | null = null;
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
      configs: isContainer ? [{name: '+children', type: 'array'}] : undefined,
    },
    namespace
  );

  const key = namespace ? `${namespace}:${name}` : name;
  componentsMap.set(key, component);
}

export function TicloFuncComp<T extends BaseProps = BaseProps>(props: T) {
  const {block} = props;
  const [functionId, setFunctionId] = useState(block.getValue('#is') as string);
  const listener = useMemo(() => ({onChange: setFunctionId, onSourceChange: () => {}}), []);
  useEffect(() => {
    const propIs = block.getProperty('#is', true);
    propIs.listen(listener);
    return () => propIs.unlisten(listener);
  }, [block, listener]);
  const C = componentsMap.get(functionId) as ComponentType<T> | undefined;
  if (C) {
    return <C {...props} />;
  }
  return null;
}

export function renderChildren<T extends BaseProps>(blocks: (ReactNode | Block)[], others: Omit<T, 'block'>) {
  const result: ReactNode[] = [];
  for (const block of blocks) {
    if (block instanceof Block) {
      result.push(<TicloFuncComp {...others} block={block} key={block._blockId} />);
    } else {
      result.push(block);
    }
  }
  return result;
}

export function findComponent<T extends BaseProps>(funcId: string) {
  return componentsMap.get(funcId) as ComponentType<T> | undefined;
}

export function isContainerFunction(funcId: unknown) {
  return typeof funcId === 'string' && containerFuncIds.has(funcId);
}
