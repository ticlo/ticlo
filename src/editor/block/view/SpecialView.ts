import React from "react";
import {ClientConnection} from "../../../core/connect/ClientConnection";


export interface SpecialViewProps {
  conn: ClientConnection;
  path: string;

  // directly notify the model about the height of the special view
  updateViewHeight?(h: number): void;
}
