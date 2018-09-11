import * as React from 'react';

export type ExpandState = 'opened' | 'closed' | 'loading' | 'empty' | 'disabled';

interface ExpandIconProps {
  opened: ExpandState;
  onClick: React.MouseEventHandler<HTMLElement>;
}

export class ExpandIcon extends React.PureComponent<ExpandIconProps, object> {
  render() {
    switch (this.props.opened) {
      case 'opened':
        return (
          <li
            onClick={this.props.onClick}
            className="anticon anticon-caret-right ticl-icn-expand"
            style={{transform: 'rotate(90deg)'}}
          />
        );
      case 'closed':
        return (
          <li
            onClick={this.props.onClick}
            className="anticon anticon-caret-right ticl-icn-expand"
          />
        );
      case 'loading':
        return (
          <li
            className="anticon anticon-loading anticon-spin ticl-icn-loading"
          />
        );
      case 'empty':
        return (
          <li
            onClick={this.props.onClick}
            className="anticon anticon-right ticl-icn-expand"
          />
        );
      default:
        return (
          <li
            className="anticon ticl-icn-expand"
          />
        );
    }
  }
}

export class TreeItem {
  opened: ExpandState = 'closed';

  children: TreeItem[] = null;

  _renderer: TreeRenderer<any, any>;
  attachedRenderer(renderer: TreeRenderer<any, any>) {
    this._renderer = renderer;
  }
  detachRenderer(renderer: TreeRenderer<any, any>) {
    if (this._renderer === renderer) {
      this._renderer = null;
    }
  }
  addToList(list: TreeItem[]) {
    list.push(this);
    if (this.opened === 'opened' && this.children) {
      for (let child of this.children) {
        child.addToList(list);
      }
    }
  }
  destroyChildren() {
    if (this.children) {
      for (let child of this.children) {
        child.destroy();
      }
      this.children = null;
    }
  }
  destroy() {
    this.destroyChildren();
  }
}


interface TreeRendererProps<T extends TreeItem> {
  item: T;
}

export class TreeRenderer<P extends TreeRendererProps<any>, S> extends React.PureComponent<P, S> {
  constructor(props: P) {
    super(props);
    this.props.item.attachedRenderer(this);
  }
  componentDidUpdate(prevProps: P) {
    if (prevProps.item !== this.props.item) {
      this.props.item.attachedRenderer(this);
    }
  }
  componentWillUnmount() {
    this.props.item.detachRenderer(this);
  }
}
