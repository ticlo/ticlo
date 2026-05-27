import React, {ComponentType, ReactNode, isValidElement, useEffect, useMemo, useRef, useState} from 'react';
import {Block} from '@ticlo/core';
import {FunctionFactory} from '@ticlo/core/block/BlockFunction.js';
import {Namespace} from '@ticlo/core/block/Namespace.js';
import {useBlockValue} from '../hooks/useBlockValue.js';

export interface BaseProps {
  block: Block;
}

export function useComponentUpdate<T extends BaseProps>(funcId: string, block?: Block) {
  const [component, setComponent] = useState<ComponentType<T> | undefined>(() => {
    if (!funcId) {
      return undefined;
    }
    const functionLib = Namespace.getFunctions(funcId, block?._flow);
    return functionLib?.getMeta(funcId, metaKey) as ComponentType<T> | undefined;
  });

  useEffect(() => {
    if (!funcId) {
      setComponent(undefined);
      return;
    }
    const functionLib = Namespace.getFunctions(funcId, block?._flow);
    const dispatcher = functionLib?.listen(funcId, null);
    if (!dispatcher) {
      setComponent(undefined);
      return;
    }

    const listener = {
      onChange(factory: FunctionFactory | null) {
        const nextComponent = factory?.getMeta(metaKey) as ComponentType<T> | undefined;
        setComponent(() => nextComponent);
      },
    };
    dispatcher.listen(listener);
    return () => dispatcher.unlisten(listener);
  }, [funcId, block]);

  return component;
}

export const metaKey = 'react';

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

function hasDynamicOutput(block: Block, functionId: string) {
  if (!functionId) {
    return false;
  }
  const desc = Namespace.getFunctions(functionId, block._flow)?.getDescToSend(functionId)[0];
  return desc?.properties?.some((prop) => {
    return prop.type === 'any' && prop.name === '#output' && prop.readonly;
  });
}

export function TicloOutputComp<T extends BaseProps = BaseProps>(props: T) {
  const {block} = props;
  const output = useBlockValue(block, '#output');

  if (output instanceof Block) {
    return <TicloComp {...props} block={output} key={output._blockId} />;
  }
  if (isValidElement(output)) {
    return output;
  }
  return null;
}

export function TicloComp<T extends BaseProps = BaseProps>(props: T) {
  const {block} = props;
  const functionId = useBlockValue<string>(block, '#is');
  const C = useComponentUpdate<T>(functionId, block);

  const propsRef = useRef(props);
  if (!isPropsEqual(propsRef.current as Record<string, unknown>, props as Record<string, unknown>)) {
    propsRef.current = props;
  }

  return useMemo(() => {
    if (C) {
      return <C {...propsRef.current} />;
    }
    if (hasDynamicOutput(block, functionId)) {
      return <TicloOutputComp {...propsRef.current} />;
    }
    return null;
  }, [functionId, C, propsRef.current]);
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
