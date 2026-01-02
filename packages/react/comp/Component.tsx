import React, {ComponentType, ReactNode, useEffect, useMemo, useRef, useState} from 'react';
import {Block, FunctionDesc, Functions, PropDesc} from '@ticlo/core';
import {FunctionClass} from '@ticlo/core/block/BlockFunction.js';
import {PropMap} from './PropType.js';

interface BaseProps {
  block: Block;
}

const componentsMap = new Map<string, ComponentType<BaseProps>>();

export function registerComponent<T extends BaseProps = BaseProps>(
  component: ComponentType<T>,
  name: string,
  propertyMap?: PropMap,
  funcDesc?: Partial<FunctionDesc>,
  namespace: string = 'react-component'
) {
  const properties: PropDesc[] = [];
  if (propertyMap) {
    for (const key of Object.keys(propertyMap)) {
      const {value, ...rest} = propertyMap[key];
      properties.push({...value.desc, ...rest, name: key});
    }
  }

  const functionClass: FunctionClass | null = null;
  Functions.add(
    functionClass,
    {
      name,
      color: '09d',
      icon: 'fas:dice-d6',
      properties,
      ...funcDesc,
    },
    namespace
  );

  const key = namespace ? `${namespace}:${name}` : name;
  componentsMap.set(key, component);
}

// custom shallow equal for props
function isPropsEqual(a: Record<string, unknown>, b: Record<string, unknown>) {
  if (a === b) return true;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (let key of keysA) {
    if (!Object.is(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

export function TicloComp<T extends BaseProps = BaseProps>(props: T) {
  const {block} = props;
  const [functionId, setFunctionId] = useState(block.getValue('#is') as string);
  const listener = useRef({onChange: setFunctionId, onSourceChange: () => {}}).current;
  useEffect(() => {
    const propIs = block.getProperty('#is', true);
    propIs.listen(listener);
    return () => propIs.unlisten(listener);
  }, [block, listener]);

  const propsRef = useRef(props);
  if (!isPropsEqual(propsRef.current as Record<string, unknown>, props as Record<string, unknown>)) {
    propsRef.current = props;
  }

  return useMemo(() => {
    const C = componentsMap.get(functionId) as ComponentType<T> | undefined;
    if (C) {
      return <C {...propsRef.current} />;
    }
    return null;
  }, [functionId, propsRef.current]);
}

export function renderChildren<T extends BaseProps>(blocks: (ReactNode | Block)[], others?: Omit<T, 'block'>) {
  const result: ReactNode[] = [];
  for (const block of blocks) {
    if (block instanceof Block) {
      result.push(<TicloComp {...others} block={block} key={block._blockId} />);
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
