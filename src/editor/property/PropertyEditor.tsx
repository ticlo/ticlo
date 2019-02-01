import React from "react";
import {ClientConnection, ValueUpdate} from "../../common/connect/ClientConnection";
import {FunctionDesc, PropDesc} from "../../common/block/Descriptor";
import {translateProperty} from "../../common/util/i18n";


interface Props {
  conn: ClientConnection;
  keys: string[];
  name: string; // name is usually same as propDesc.name, but when it's in group, it will have a number after
  funcDesc: FunctionDesc;
  propDesc: PropDesc;
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
    let {funcDesc, propDesc, name} = this.props;
    return (
      <div className='ticl-field'>
        <div className='ticl-field-name'>
          {translateProperty(funcDesc.name, name, funcDesc.ns)}
        </div>
        <div className='ticl-field-value'/>
      </div>
    );
  }
}