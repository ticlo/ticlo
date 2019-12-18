import React from 'react';
import {FunctionDesc, PropDesc} from '../../../core/block/Descriptor';
import {ClientConn} from '../../../core/client';

// export type ChangeReason = 'minus' | 'plus' | 'enter' | 'blur';

export interface ValueEditorProps {
  conn?: ClientConn;
  keys?: string[];
  value: any;
  desc: PropDesc;
  locked?: boolean;
  onChange?: (value: any) => void;
  addSubBlock?: (id: string, desc?: FunctionDesc, data?: any) => void;
}
