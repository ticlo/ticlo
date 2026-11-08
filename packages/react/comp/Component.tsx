import React, {ComponentType, ReactNode, useContext, useMemo, useSyncExternalStore} from 'react';
import {Block} from '@ticlo/core';
import {Library} from '@ticlo/core/block/Library.ts';
import {useBlockValue} from '../hooks/useBlockValue.ts';
import {TicloPage} from './TicloPage.tsx';
import {ComponentContext, ComponentRenderContext, defaultComponentContext} from '../ComponentContext.ts';

export interface BaseProps {
  block: Block;
}

export function useComponentUpdate<T extends BaseProps>(funcId: string, block?: Block) {
  const store = useMemo(() => {
    const dispatcher = funcId ? Library.getFunctions(funcId, block?._flow)?.listen(funcId, null) : undefined;
    return {
      getSnapshot: () => dispatcher?.getValue()?.getMeta(metaKey) as ComponentType<T> | undefined,
      subscribe: (onChange: () => void) => {
        const listener = {onChange};
        dispatcher?.listen(listener);
        return () => dispatcher?.unlisten(listener);
      },
    };
  }, [funcId, block]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export const metaKey = 'react';

function TicloCompView<T extends BaseProps = BaseProps>(props: T) {
  const {block} = props;
  const parentContext = useContext(ComponentContext);
  const renderContext = useContext(ComponentRenderContext);
  const context = renderContext
    ? block._flow === renderContext.flow
      ? renderContext.context
      : defaultComponentContext
    : parentContext;
  const functionId = useBlockValue<string>(block, '#is');
  const C = useComponentUpdate<T>(functionId, block);

  return useMemo(
    () => (
      <ComponentContext.Provider value={context}>
        {C ? <C {...props} key={props.block._blockId} /> : <TicloPage {...props} key={props.block._blockId} />}
      </ComponentContext.Provider>
    ),
    [C, props, context]
  );
}

export const TicloComp = React.memo(TicloCompView) as typeof TicloCompView;

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
