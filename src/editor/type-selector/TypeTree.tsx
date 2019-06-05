import React from "react";
import {ClientConnection, FunctionDesc, getFuncStyleFromDesc} from "../../core/client";
import {TypeTreeItem, TypeTreeRoot} from "./TypeTreeItem";
import VirtualList from "../../ui/component/Virtual";
import {TypeTreeRenderer} from "./TypeTreeRenderer";

interface Props {
  conn: ClientConnection;
  style?: React.CSSProperties;
}

interface State {

}

export class TypeTree extends React.PureComponent<Props, State> {

  rootNode: TypeTreeRoot;
  list: TypeTreeItem[] = [];

  constructor(props: Props) {
    super(props);
    this.rootNode = new TypeTreeRoot(props.conn, this.forceUpdateImmediate);
  }

  forceUpdateLambda = () => this.forceUpdate();
  forceUpdateImmediate = () => {
    if (this.rendered) {
      this.props.conn.callImmediate(this.forceUpdateLambda);
    }
  };

  renderChild = (idx: number, style: React.CSSProperties) => {
    let item = this.list[idx];
    return (
      <TypeTreeRenderer item={item} key={item.key} style={style}/>
    );
  };


  refreshList() {
    this.list.length = 0;
    for (let item of this.rootNode.children) {
      item.addToList(this.list);
    }
  }

  rendered: boolean = false;

  render() {
    let {style} = this.props;
    this.refreshList();
    this.rendered = true;
    return (
      <VirtualList style={style}
                   className='ticl-node-tree'
                   renderer={this.renderChild}
                   itemCount={this.list.length}
                   itemHeight={30}
      />
    );

  }

  componentWillUnmount(): void {
    this.rootNode.destroy();
  }
}
