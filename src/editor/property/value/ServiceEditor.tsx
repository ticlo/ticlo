import React from "react";
import {ClientConnection} from "../../../core/connect/ClientConnection";
import {PropDesc} from "../../../core/block/Descriptor";
import {arrayEqual} from "../../../core/util/Compare";
import {Select} from "antd";

const {Option} = Select;

export interface Props {
  conn?: ClientConnection;
  value: any;
  bindingPath: string;
  desc: PropDesc;
  locked?: boolean;
  onPathChange?: (path: string) => void;
}

interface State {
  opened?: null | 'add' | 'edit';
}


export class ServiceEditor extends React.PureComponent<Props, State> {

  state: State = {};

  onGlobalBlockSelect = (value: string) => {
    let {onPathChange} = this.props;
    onPathChange(`${value}.output`);
  };

  render() {
    let {bindingPath, conn, desc, locked, onPathChange} = this.props;
    let {opened} = this.state;

    let globalNames = conn.findGlobalBlocks(desc.options as string[]);

    let optionNodes: React.ReactNode[] = [];
    for (let name of globalNames) {
      optionNodes.push(<Option key={name} value={name}>{name}</Option>);
    }

    let selectValue = bindingPath;
    if (typeof selectValue === 'string' && selectValue.endsWith('.output')) {
      selectValue = selectValue.substring(0, selectValue.length - 7);
    }

    return (
      <div className='ticl-hbox ticl-service-editor'>
        <Select size='small' value={selectValue} disabled={locked || onPathChange == null}
                onChange={this.onGlobalBlockSelect}>
          {optionNodes}
        </Select>
      </div>
    );
  }
}