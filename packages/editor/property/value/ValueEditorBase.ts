import React from 'react';
import {FunctionDesc, PropDesc, ClientConn} from '@ticlo/core';

// export type ChangeReason = 'minus' | 'plus' | 'enter' | 'blur';

export interface ValueEditorProps {
  conn?: ClientConn;
  keys?: string[];
  name?: string;
  value: any;
  funcDesc: FunctionDesc;
  desc: PropDesc;
  locked?: boolean;
  onChange?: (value: any, field: string) => void;
  addSubBlock?: (id: string, desc?: FunctionDesc, data?: any) => void;
}
