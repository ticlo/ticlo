import React from 'react';
import {ClientConn} from '@ticlo/core/editor.ts';
import VirtualList from '../component/Virtual.tsx';
import {ObjectTreeItem, ObjectTreeRenderer} from './ObjectRenderer.tsx';
import {LazyUpdateComponent} from '../component/LazyUpdateComponent.tsx';

interface Props {
  conn: ClientConn;
  path?: string;
  data: object;
  style?: React.CSSProperties;
}

export class ObjectTree extends LazyUpdateComponent<Props, any> {
  root: ObjectTreeItem;
  list: ObjectTreeItem[] = [];

  private source: object;
  private rootVersion = 0;

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
    const {conn, path, data} = this.props;
    if (this.root && this.source === data && this.root.rootPath === path && this.root.connection === conn) {
      return;
    }
    this.root?.destroy();
    ++this.rootVersion;
    this.source = data;
    this.root = new ObjectTreeItem(path, '', data, null);
    this.root.connection = conn;
    this.root.onListChange = this.forceUpdateLambda;
    if (this.root.opened === 'closed') {
      this.root.open();
    }
  }

  renderImpl() {
    const {style} = this.props;
    this.buildRoot();
    this.refreshList();
    return (
      <div className="ticl-e-object-tree" style={style}>
        <VirtualList
          key={`${this.rootVersion}:${this.root.generation}`}
          className="ticl-e-node-tree"
          style={style}
          renderer={this.renderChild}
          itemCount={this.list.length}
          itemHeight={26}
        />
      </div>
    );
  }

  componentWillUnmount(): void {
    this.root?.destroy();
    super.componentWillUnmount();
  }
}
