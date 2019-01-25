import React from "react";
import {ClientConnection, ValueUpdate} from "../../common/connect/ClientConnection";


interface Props {
  conn: ClientConnection;
  keys: string[];
  name: string;
}


export class PropertyEditor extends React.Component<Props, any> {

  subscriptions: Map<string, ValueUpdate> = new Map<string, ValueUpdate>();

  updateSubscriptions() {

  }

  constructor(props: Readonly<Props>) {
    super(props);
    this.updateSubscriptions();
  }

  render() {
    return <div/>;
  }
}