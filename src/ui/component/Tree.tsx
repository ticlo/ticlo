import * as React from 'react';

export type ExpandState = 'opened' | 'closed' | 'loading' | 'empty' | 'disabled';

export interface ExpandIconProps {
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
      case 'empty' :
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
