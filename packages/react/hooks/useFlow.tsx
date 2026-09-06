import React, {useContext, useEffect, useId, useMemo, useRef, createContext, ReactNode} from 'react';
import {DataMap, Flow, Root} from '@ticlo/core';

export const FlowContext = createContext<Flow>(null);

export const useFlow = () => useContext(FlowContext);

export function FlowRoot({
  flow,
  name,
  children,
}: {
  flow: Flow | DataMap;
  name?: string;
  children: ReactNode | ReactNode[];
}) {
  const reactId = useId();
  const tempId = useMemo(() => `temp-flow-${reactId.replace(/\W/g, '')}`, [reactId]);

  const f: Flow = useMemo(() => {
    if (flow instanceof Flow) {
      return flow;
    }
    const flowName = name || tempId;
    // TODO isValidFlowName
    const v = Root.instance.getValue(flowName);
    if (v instanceof Flow) {
      return v;
    }
    return Root.instance.addFlow(flowName, flow);
  }, [flow, name, tempId]);

  const retainedTempFlow = useRef<Flow | null>(null);
  const ownsTempFlow = !(flow instanceof Flow) && !name;
  useEffect(() => {
    if (!ownsTempFlow) {
      return;
    }
    retainedTempFlow.current = f;
    return () => {
      retainedTempFlow.current = null;
      queueMicrotask(() => {
        if (retainedTempFlow.current !== f && Root.instance.getValue(tempId) === f) {
          Root.instance.deleteValue(tempId);
        }
      });
    };
  }, [f, ownsTempFlow, tempId]);

  return <FlowContext.Provider value={f}>{children}</FlowContext.Provider>;
}
