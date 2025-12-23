import React, {useContext, useMemo, createContext, ReactNode} from 'react';
import {DataMap, Flow, Root} from '@ticlo/core';
import {Uid} from '@ticlo/core/util/Uid.js';

const tempFlowId = new Uid();

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
  const tempId = useMemo(() => `temp-flow-${tempFlowId.next()}`, []);

  const f: Flow = useMemo(() => {
    if (flow instanceof Flow) {
      return f;
    }
    let flowName = name || tempId;
    // TODO isValidFlowName
    let v = Root.instance.getValue(flowName);
    if (v instanceof Flow) {
      return v;
    }
    return Root.instance.addFlow(name, flow);
  }, [flow, name, tempId]);

  return <FlowContext.Provider value={f}>{children}</FlowContext.Provider>;
}
