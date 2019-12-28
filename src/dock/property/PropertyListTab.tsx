import React, {ReactNode} from 'react';
import {BlockStage, PropertyList} from '../../editor';
import {Divider, DockContext, DockContextType} from 'rc-dock/lib';
import {arrayEqual} from '../../core/util/Compare';
import {Button} from 'antd';
import {Popup} from '../../editor/component/ClickPopup';
import {ClientConn} from '../../core/connect/ClientConn';
import {TrackedClientConn} from '../../core/connect/TrackedClientConn';
import {TicloLayoutContext, TicloLayoutContextType} from '../../editor/component/LayoutContext';

interface Props {
  conn: ClientConn;
}

interface State {
  selectedKeys: string[];
}

export class PropertyListTab extends React.PureComponent<Props, State> {
  static contextType = TicloLayoutContextType;
  context!: TicloLayoutContext;

  state: State = {selectedKeys: []};

  onChange(selectedKeys: string[]) {
    this.setState({selectedKeys});
  }

  onSourceChange(source: any): void {}

  componentDidMount(): void {
    // tslint:disable-next-line
    this.context.selectedKeys.listen(this);
  }

  render() {
    let {conn} = this.props;
    let {selectedKeys} = this.state;

    return (
      <PropertyList conn={conn} keys={selectedKeys || []} style={{width: '100%', height: '100%', padding: '8px'}} />
    );
  }
}
