import React from "react";
import {PropDesc} from "../../../core/block/Descriptor";
import {ClientConnection} from "../../../core/connect/ClientConnection";

// export type ChangeReason = 'minus' | 'plus' | 'enter' | 'blur';

export interface ValueEditorProps {
  conn?: ClientConnection;
  keys?: string[];
  value: any;
  desc: PropDesc;
  locked?: boolean;
  onChange?: (value: any) => void;
}
