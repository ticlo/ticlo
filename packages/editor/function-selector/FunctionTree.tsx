import React from 'react';
import {ClientConn, FunctionDesc} from '@ticlo/core/editor.ts';
import {FunctionTreeItem, FunctionTreeRoot} from './FunctionTreeItem.ts';
import VirtualList from '../component/Virtual.tsx';
import {FunctionTreeRenderer} from './FunctionTreeRenderer.tsx';
import {OnFunctionClick} from './FunctionView.tsx';

interface Props {
  conn: ClientConn;
  search?: string;
  filter?: (desc: FunctionDesc) => boolean;
  showPreset?: boolean;
  onFunctionClick?: OnFunctionClick;
  onAddFunction?: (prefix: string) => void;
  funcLib?: string;
  style?: React.CSSProperties;
}

interface State {}

export class FunctionTree extends React.PureComponent<Props, State> {
  rootNode: FunctionTreeRoot;
  list: FunctionTreeItem[] = [];

  buildRoot() {
    const props = this.props;
    this.rootNode = new FunctionTreeRoot(
      props.conn,
      this.forceUpdateImmediate,
      props.onFunctionClick,
      props.showPreset,
      props.filter,
      props.funcLib,
      props.onAddFunction
    );
  }

  componentDidMount() {
    this.buildRoot();
    this.forceUpdate();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.funcLib !== this.props.funcLib ||
      prevProps.conn !== this.props.conn ||
      prevProps.onAddFunction !== this.props.onAddFunction
    ) {
      this.rootNode.destroy();
      this.buildRoot();
      this.forceUpdate();
    }
  }

  forceUpdateLambda = () => this.forceUpdate();
  forceUpdateImmediate = () => {
    if (this.rendered) {
      this.props.conn.callImmediate(this.forceUpdateLambda);
    }
  };

  renderChild = (idx: number, style: React.CSSProperties) => {
    const item = this.list[idx];
    return <FunctionTreeRenderer item={item} key={item.key} style={style} />;
  };

  refreshList() {
    let {search} = this.props;
    search = (search ?? '').trim().toLowerCase();
    this.list.length = 0;
    for (const item of this.rootNode?.children ?? []) {
      item.addToList(this.list, search);
    }
  }

  rendered: boolean = false;

  render() {
    const {style} = this.props;
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
    this.rendered = false;
    this.rootNode.destroy();
    this.rootNode = null;
  }
}
