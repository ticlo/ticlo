import * as React from 'react';

export type ExpandState = 'opened' | 'closed' | 'loading' | 'empty' | 'disabled';

export interface TreeItem {
  level: number;
  key: string;
  opened: ExpandState;

  renderer(): React.ReactNode | React.ReactNode[];

  onClick(): void;

  onAttachUI(): void;

  onDetachUI(): void;

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
    this.props.item.onClick();
  };

  opened?: ExpandState;

  render() {
    if (this.props.item !== this.currentItem) {
      if (this.currentItem && this.currentItem.openedChangeCallback === this.forceUpdateLambda) {
        this.currentItem.openedChangeCallback = undefined;
        this.currentItem.onDetachUI();
      }
      this.currentItem = this.props.item;
      if (this.currentItem) {
        this.currentItem.openedChangeCallback = this.forceUpdateLambda;
        this.currentItem.onAttachUI();
      }
    }
    this.opened = this.props.item.opened;
    switch (this.opened) {
      case 'opened':
        return (
          <li
            onClick={this.clickHandler}
            className="anticon anticon-caret-right ticl-icn-expand"
            style={{transform: 'rotate(90deg)'}}
          />
        );
      case 'closed':
        return (
          <li
            onClick={this.clickHandler}
            className="anticon anticon-caret-right ticl-icn-expand"
          />
        );
      case 'loading':
        return (
          <li
            className="anticon anticon-loading anticon-spin ticl-icn-loading"
          />
        );
      case 'empty' :
        return (
          <li
            onClick={this.clickHandler}
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

  componentWillUnmount() {
    if (this.currentItem && this.currentItem.openedChangeCallback === this.forceUpdateLambda) {
      this.currentItem.openedChangeCallback = undefined;
      this.currentItem.onDetachUI();
    }
  }
}

export function renderTreeItem(item: TreeItem, style?: React.CSSProperties): React.ReactNode {
  let marginLeft = item.level * 24;
  return <div key={item.key} style={{...style, marginLeft}}><ExpandIcon item={item}/>{item.renderer()}</div>;
}