import React from "react";
import {FunctionDesc, getFuncStyleFromDesc} from "../../core/client";
import {TIcon} from "../icon/Icon";
import {DragDropDiv, DragState} from "rc-dock/lib";
import {ClientConnection} from "../../core/connect/ClientConnection";

interface Props {
  conn: ClientConnection;
  desc: FunctionDesc;
  data?: any;
}

export class TypeView extends React.PureComponent<Props, any> {

  onDrag = (e: DragState) => {
    let {conn, data, desc} = this.props;

    if (!data) {
      data = {
        '#is': desc.id
      };
    }
    e.setData({
      block: data
    }, conn);
    e.startDrag();
  };

  render() {
    let {desc} = this.props;
    return (
      <DragDropDiv className={`${getFuncStyleFromDesc(desc, 'tico-pr')} ticl-hbox`} onDragStartT={this.onDrag}>
        <TIcon icon={desc.icon}/>
        {desc.name}
      </DragDropDiv>
    );
  }
}