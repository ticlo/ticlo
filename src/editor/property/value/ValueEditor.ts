import React from "react";
import {PropDesc} from "../../../core/block/Descriptor";

// export type ChangeReason = 'minus' | 'plus' | 'enter' | 'blur';

export interface ValueEditorProps {
  value: any;
  desc: PropDesc;
  locked?: boolean;
  onChange?: (value: any) => void;
}
