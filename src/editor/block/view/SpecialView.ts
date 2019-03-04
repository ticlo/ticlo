import React from "react";
import {ClientConnection} from "../../../common/connect/ClientConnection";

// export type ChangeReason = 'minus' | 'plus' | 'enter' | 'blur';

export interface SpecialViewProps {
  conn: ClientConnection;
  path: string;
}
