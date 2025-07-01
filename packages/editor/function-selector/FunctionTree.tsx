import React from 'react';
import {ClientConn, FunctionDesc} from '@ticlo/core';
import {FunctionTreeItem, FunctionTreeRoot} from './FunctionTreeItem';
import VirtualList from '../component/Virtual';
import {FunctionTreeRenderer} from './FunctionTreeRenderer';
import {OnFunctionClick} from './FunctionView';

interface Props {
  conn: ClientConn;
  search?: string;
  filter?: (desc: FunctionDesc) => boolean;
  showPreset?: boolean;
  onFunctionClick?: OnFunctionClick;
  style?: React.CSSProperties;
}

interface State {}

export class FunctionTree extends React.PureComponent<Props, State> {
  rootNode: FunctionTreeRoot;
  list: FunctionTreeItem[] = [];

  constructor(props: Props) {
    super(props);
    this.rootNode = new FunctionTreeRoot(
      props.conn,
      this.forceUpdateImmediate,
      props.onFunctionClick,
      props.showPreset,
      props.filter
    );
  }

  forceUpdateLambda = () => this.forceUpdate();
  forceUpdateImmediate = () => {
    if (this.rendered) {
      this.props.conn.callImmediate(this.forceUpdateLambda);
    }
  };

  renderChild = (idx: number, style: React.CSSProperties) => {
    let item = this.list[idx];
    return <FunctionTreeRenderer item={item} key={item.key} style={style} />;
  };

  refreshList() {
    let {search} = this.props;
    search = search.trim().toLowerCase();
    this.list.length = 0;
    for (let item of this.rootNode.children) {
      item.addToList(this.list, search);
    }
  }

  rendered: boolean = false;

  render() {
    let {style} = this.props;
    this.refreshList();
    this.rendered = true;
    return (
      <VirtualList
        style={style}
        className="ticl-func-tree"
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
