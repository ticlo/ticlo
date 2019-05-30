import React from "react";
import {FunctionDesc, getFuncStyleFromDesc, PropDesc, PropGroupDesc} from "../../core/client";
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

    // add default props
    let props = [];
    for (let propDesc of desc.properties) {
      if ((propDesc as PropGroupDesc).properties) {
        for (let i = 0; i < 2; ++i) {
          for (let childDesc of (propDesc as PropGroupDesc).properties) {
            if ((childDesc as PropDesc).visible !== 'low') {
              props.push(`${(childDesc as PropDesc).name}${i}`);
            }
          }
        }
      } else if ((propDesc as PropDesc).visible !== 'low') {
        props.push((propDesc as PropDesc).name);
      }
    }
    data['@b-p'] = props;

    e.setData({
      block: data
    }, conn);
    e.startDrag();
  };

  render() {
    let {desc} = this.props;
    return (
      <DragDropDiv className={`${getFuncStyleFromDesc(desc, 'tico-pr')} ticl-type-view`} onDragStartT={this.onDrag}>
        <TIcon icon={desc.icon}/>
        <span> {desc.name}</span>

      </DragDropDiv>
    );
  }
}