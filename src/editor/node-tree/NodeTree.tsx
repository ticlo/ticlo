import * as React from "react";
import {ExpandState} from "../../ui/component/Tree";
import VirtualList from "../../ui/component/Virtual";
import {ClientConnection} from "../../common/connect/ClientConnection";
import {DataMap} from "../../common/util/Types";
import {NodeTreeItem, NodeTreeRenderer} from "./NodeRenderer";


interface Props {
  conn: ClientConnection;
  basePath: string;
  style?: React.CSSProperties;
}

interface State {

  itemHeight: number;
  renderer: (idx: number, style: React.CSSProperties) => React.ReactNode;
}

export default class NodeTree extends React.PureComponent<Props, State> {
  rootList: NodeTreeItem[] = [];
  state: State;
  list: NodeTreeItem[] = [];

  renderChild(idx: number, style: React.CSSProperties): React.ReactNode {
    let item = this.list[idx];
    return (
      <NodeTreeRenderer item={item} key={item.key} style={style} onListChange={this.forceUpdateLambda}
                        connection={this.props.conn}/>
    );
  }

  forceUpdateLambda = () => this.forceUpdate();

  refreshList() {
    this.list.length = 0;
    for (let item of this.rootList) {
      item.addToList(this.list);
    }
  }

  constructor(props: Props) {
    super(props);
    let rootNode = new NodeTreeItem(props.basePath);
    this.rootList.push(rootNode);
    this.state = {
      itemHeight: 30,
      renderer: (i, style) => this.renderChild(i, style)
    };
  }

  render() {
    this.refreshList();
    return (
      <VirtualList
        style={this.props.style}
        renderer={this.state.renderer}
        itemCount={this.list.length}
        itemHeight={this.state.itemHeight}
      />
    );
  }
}
