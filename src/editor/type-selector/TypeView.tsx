import React from "react";
import {FunctionDesc, getDefaultFuncData, getFuncStyleFromDesc, PropDesc, PropGroupDesc} from "../../core/client";
import {TIcon} from "../icon/Icon";
import {DragDropDiv, DragState} from "rc-dock/lib";
import {ClientConnection} from "../../core/connect/ClientConnection";

export type OnTypeClick = (name: string, desc: FunctionDesc, data: any) => void;

interface Props {
  conn: ClientConnection;
  desc: FunctionDesc;
  name?: any;
  data?: any;
  onClick?: OnTypeClick;
}

export class TypeView extends React.PureComponent<Props, any> {

  onDrag = (e: DragState) => {
    let {conn, data, desc} = this.props;

    if (!data) {
      data = getDefaultFuncData(desc);
    }

    e.setData({
      block: data
    }, conn);
    e.startDrag();
  };

  onClick = (e: React.MouseEvent) => {
    let {onClick, desc, name, data} = this.props;
    if (onClick) {
      if (!name) {
        name = desc.name;
      }
      onClick(name, desc, data);
    }
  };

  render() {
    let {desc, name} = this.props;
    if (!name) {
      name = desc.name;
    }
    return (
      <DragDropDiv className={`${getFuncStyleFromDesc(desc, 'tico-pr')} ticl-type-view`}
                   onClick={this.onClick} onDragStartT={this.onDrag}>
        <TIcon icon={desc.icon}/>
        <span>{name}</span>

      </DragDropDiv>
    );
  }
}