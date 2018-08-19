import * as React from 'react';

export type ExpandState = boolean | 'loading' | null;

export interface TreeItem {
  level: number;
  key: string;
  opened: ExpandState;

  renderer(): React.ReactNode | React.ReactNode[];

  expand(open: boolean): void;

  openedChangeCallback?: () => void;

  // a callback to update UI state
  refreshListCallback?: () => void;
}

export interface ExpandIconProps {
  item: TreeItem;
}

export class ExpandIcon extends React.PureComponent<ExpandIconProps, object> {

  forceUpdateLambda = () => this.forceUpdate();
  currentItem?: TreeItem;

  clickHandler = (e: React.MouseEvent<HTMLElement>) => {
    if (this.opened === false) {
      this.props.item.expand(true);
    } else if (this.opened === true) {
      this.props.item.expand(false);
    }
  };

  opened?: ExpandState;

  render() {
    if (this.props.item !== this.currentItem) {
      if (this.currentItem && this.currentItem.openedChangeCallback === this.forceUpdateLambda) {
        this.currentItem.openedChangeCallback = undefined;
      }
      this.currentItem = this.props.item;
      if (this.currentItem) {
        this.currentItem.openedChangeCallback = this.forceUpdateLambda;
      }
    }
    this.opened = this.props.item.opened;
    if (this.opened === 'loading') {
      return (
        <li
          className="anticon anticon-loading anticon-spin tclo-icn-loading"
        />
      );
    } else if (this.opened === null) {
      return (
        <li
          className="anticon tclo-icn-expand"
        />
      );
    } else {
      return (
        <li
          onClick={this.clickHandler}
          className="anticon anticon-caret-right tclo-icn-expand"
          style={{transform: this.opened ? 'rotate(90deg)' : ''}}
        />
      );
    }
  }

  componentWillUnmount() {
    if (this.currentItem && this.currentItem.openedChangeCallback === this.forceUpdateLambda) {
      this.currentItem.openedChangeCallback = undefined;
    }
  }
}

export function renderTreeItem(item: TreeItem, style?: React.CSSProperties): React.ReactNode {
  let marginLeft = item.level * 24;
  return <div key={item.key} style={{...style, marginLeft}}><ExpandIcon item={item}/>{item.renderer()}</div>;
}