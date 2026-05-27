import React, {ComponentType, ReactNode, isValidElement, useMemo, useRef} from 'react';
import {Block} from '@ticlo/core';
import {Namespace} from '@ticlo/core/block/Namespace.js';
import {useBlockValue} from '../hooks/useBlockValue.js';

export interface BaseProps {
  block: Block;
}

export function findComponent<T extends BaseProps>(funcId: string, block?: Block) {
  if (!funcId) {
    return undefined;
  }
  return Namespace.getFunctions(funcId, block?._flow)?.getMeta(funcId, metaKey) as ComponentType<T> | undefined;
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

  const propsRef = useRef(props);
  if (!isPropsEqual(propsRef.current as Record<string, unknown>, props as Record<string, unknown>)) {
    propsRef.current = props;
  }

  return useMemo(() => {
    const C = findComponent<T>(functionId, block);
    if (C) {
      return <C {...propsRef.current} />;
    }
    if (hasDynamicOutput(block, functionId)) {
      return <TicloOutputComp {...propsRef.current} />;
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
