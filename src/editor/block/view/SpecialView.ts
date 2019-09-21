import React from "react";
import {ClientConn} from "../../../core/client";


export interface SpecialViewProps {
  conn: ClientConn;
  path: string;

  // directly notify the model about the height of the special view
  updateViewHeight(h: number): void;
}
