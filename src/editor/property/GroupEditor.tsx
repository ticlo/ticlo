import React from "react";
import {ClientConnection, ValueUpdate} from "../../common/connect/ClientConnection";
import {FunctionDesc, PropDesc, PropGroupDesc} from "../../common/block/Descriptor";


interface Props {
  conn: ClientConnection;
  keys: string[];
  funcDesc: FunctionDesc;
  groupDesc: PropGroupDesc;
}

interface State {
  length: number;
}


export class GroupEditor extends React.Component<Props, State> {

}
