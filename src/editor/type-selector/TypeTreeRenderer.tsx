import React from "react";
import {ExpandIcon} from "../../ui/component/Tree";
import {TIcon} from "../icon/Icon";
import {blankFuncDesc, getFuncStyleFromDesc} from "../../core/block/Descriptor";
import {TypeView} from "./TypeView";
import {TypeTreeItem} from "./TypeTreeItem";

interface Props {
  item: TypeTreeItem;
  style?: React.CSSProperties;
}


export class TypeTreeRenderer extends React.PureComponent<Props, any> {
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
    let {item, style} = this.props;
    let {name, connection, desc, data} = item;
    let marginLeft = item.level * 24;
    if (desc) {
      return (
        <div style={{...style, marginLeft}} className="ticl-tree-node">
          <ExpandIcon opened={item.opened} onClick={this.onExpandClicked}/>
          <TypeView conn={connection} desc={desc} name={name} data={data}/>
        </div>
      );
    } else {
      let child = item.children[0];
      let icon: string;
      let funcStyle: string;
      if (child && child.desc) {
        icon = child.desc.icon;
        funcStyle = getFuncStyleFromDesc(child.desc, 'tico-pr');
      }
      return (
        <div style={{...style, marginLeft}} className="ticl-tree-node">
          <ExpandIcon opened={item.opened} onClick={this.onExpandClicked}/>
          <TIcon icon={icon} style={funcStyle}/>
          <span>{name}</span>
        </div>
      );
    }
  }

}
