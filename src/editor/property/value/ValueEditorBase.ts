import React from "react";
import {PropDesc} from "../../../core/block/Descriptor";
import {ClientConn} from "../../../core/client";

// export type ChangeReason = 'minus' | 'plus' | 'enter' | 'blur';

export interface ValueEditorProps {
  conn?: ClientConn;
  keys?: string[];
  value: any;
  desc: PropDesc;
  locked?: boolean;
  onChange?: (value: any) => void;
}
