import React from 'react';
import VirtualList from '../../ui/component/Virtual';
import {ObjectTreeItem, ObjectTreeRenderer} from './ObjectRenderer';
import {ClientConn} from '../../core/connect/ClientConn';
import {LazyUpdateComponent} from '../../ui/component/LazyUpdateComponent';
import {DataMap, isDataTruncated} from '../../core/util/DataTypes';
import {Spin} from 'antd';

interface Props {
  conn: ClientConn;
  path: string;
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
      this.loading = false;
      this.data = response.value;
      this.forceUpdate();
    }
  };

  constructor(props: Props) {
    super(props);
    if (isDataTruncated(props.data)) {
      this.loading = true;
      props.conn.getValue(props.path, this.getValueCallback);
    } else {
      this.data = props.data;
    }
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
    let {conn, path, data} = this.props;
    if (this.root && this.root.data === data) {
      return;
    }
    this.root = new ObjectTreeItem(path, '', data, null);
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
