import React from 'react';
import {Spin} from 'antd';
import {ClientConn, deepEqual, DataMap, isDataTruncated} from '../../../src/core/editor';
import VirtualList from '../component/Virtual';
import {ObjectTreeItem, ObjectTreeRenderer} from './ObjectRenderer';
import {LazyUpdateComponent} from '../component/LazyUpdateComponent';

interface Props {
  conn: ClientConn;
  path?: string;
  data: object;
  style?: React.CSSProperties;
}

export class ObjectTree extends LazyUpdateComponent<Props, any> {
  root: ObjectTreeItem;
  list: ObjectTreeItem[] = [];

  loading = false;
  data: any;
  getValueCallback = {
    onUpdate: (response: DataMap) => {
      this.data = response.value;
      this.loading = false;
      this.forceUpdate();
    }
  };

  constructor(props: Props) {
    super(props);
    this.checkTruncatedValue(props.data);
  }

  checkTruncatedValue(data: any) {
    const {conn, path} = this.props;
    if (isDataTruncated(data)) {
      this.loading = true;
      conn.getValue(path, this.getValueCallback);
    } else {
      this.data = data;
    }
  }
  shouldComponentUpdate(nextProps: Readonly<Props>, nextState: Readonly<any>): boolean {
    if (!deepEqual(nextProps.data, this.data)) {
      this.checkTruncatedValue(nextProps.data);
      return true;
    }
    return super.shouldComponentUpdate(nextProps, nextState);
  }

  renderChild = (idx: number, style: React.CSSProperties) => {
    const item = this.list[idx];
    return <ObjectTreeRenderer item={item} key={item.key} style={style} />;
  };

  refreshList() {
    this.list.length = 0;
    this.root.addToList(this.list);
  }

  forceUpdateLambda = () => this.forceUpdate();

  buildRoot() {
    let {conn, path} = this.props;
    if (this.root && this.root.data === this.data) {
      return;
    }
    this.root = new ObjectTreeItem(path, '', this.data, null);
    this.root.connection = conn;
    this.root.onListChange = this.forceUpdateLambda;
    if (this.root.opened === 'closed') {
      this.root.open();
    }
  }

  renderImpl() {
    let child: React.ReactNode;
    if (this.loading) {
      child = <Spin tip="Loading..." />;
    } else {
      this.buildRoot();
      this.refreshList();
      child = (
        <VirtualList
          className="ticl-node-tree"
          style={this.props.style}
          renderer={this.renderChild}
          itemCount={this.list.length}
          itemHeight={26}
        />
      );
    }

    return (
      <div className="ticl-object-tree" style={this.props.style}>
        {child}
      </div>
    );
  }

  componentWillUnmount(): void {
    this.root.destroy();
    super.componentWillUnmount();
  }
}
