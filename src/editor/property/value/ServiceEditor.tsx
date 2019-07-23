import React from "react";
import {ClientConnection} from "../../../core/connect/ClientConnection";
import {PropDesc} from "../../../core/block/Descriptor";

export interface Props {
  conn?: ClientConnection;
  value: any;
  bindingPath: string;
  desc: PropDesc;
  locked?: boolean;
  onPathChange?: (path: string) => void;
}


export class ServiceEditor extends React.PureComponent<any, any> {

  render() {
    return <div/>;
  }
}