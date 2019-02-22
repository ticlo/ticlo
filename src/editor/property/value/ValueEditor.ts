import * as React from "react";
import {PropDesc} from "../../../common/block/Descriptor";


export interface ValueEditorProps {
  value: any;
  desc: PropDesc;
  locked?: boolean;
  onChange?: (value: any) => void;
}
