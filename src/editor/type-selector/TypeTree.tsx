import React from "react";
import {ExpandIcon, TreeItem} from "../../ui/component/Tree";
import {ClientConnection, FunctionDesc, getFuncStyleFromDesc} from "../../core/client";
import {TIcon} from "../icon/Icon";
import {Dropdown} from "antd";
import {TypeView} from "./TypeView";

class TypeTreeItem extends TreeItem {
  conn: ClientConnection;
  desc: FunctionDesc;
  data?: any;


  getConn(): ClientConnection {
    return this.conn;
  }

  open() {
    this.opened = 'opened';
    this.forceUpdate();
  }

  close() {
    this.opened = 'closed';
    this.forceUpdate();
  }
}

interface Props {
  item: TypeTreeItem;
}

export class TypeTreeView extends React.PureComponent<Props, any> {
  onExpandClicked = () => {
    let {item} = this.props;
    switch (item.opened) {
      case 'opened':
        item.close();
        break;
      case 'closed':
      case 'empty':
        item.open();
        break;
    }
  };

  render() {
    let {item} = this.props;
    let {conn, desc, data} = item;
    let marginLeft = item.level * 24;
    return (
      <div style={{marginLeft}} className="ticl-tree-node">
        <ExpandIcon opened={item.opened} onClick={this.onExpandClicked}/>
        <TIcon icon={desc.icon} style={getFuncStyleFromDesc(desc, 'tico-pr')}/>
        <TypeView conn={conn} desc={desc} data={data}/>
      </div>
    );
  }
}
