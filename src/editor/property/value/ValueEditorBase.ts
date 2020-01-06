import React from 'react';
import {FunctionDesc, PropDesc, ClientConn} from '../../../../src/core/editor';

// export type ChangeReason = 'minus' | 'plus' | 'enter' | 'blur';

export interface ValueEditorProps {
  conn?: ClientConn;
  keys?: string[];
  name?: string;
  value: any;
  desc: PropDesc;
  locked?: boolean;
  onChange?: (value: any) => void;
  addSubBlock?: (id: string, desc?: FunctionDesc, data?: any) => void;
}
