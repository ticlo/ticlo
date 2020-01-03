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
  selectedPaths: string[];
}

export class PropertyListTab extends React.PureComponent<Props, State> {
  static contextType = TicloLayoutContextType;
  context!: TicloLayoutContext;

  state: State = {selectedPaths: []};

  onChange(selectedPaths: string[]) {
    this.setState({selectedPaths});
  }

  onSourceChange(source: any): void {}

  componentDidMount(): void {
    // tslint:disable-next-line
    this.context.selectedPaths.listen(this);
  }

  render() {
    let {conn} = this.props;
    let {selectedPaths} = this.state;

    return (
      <PropertyList conn={conn} paths={selectedPaths || []} style={{width: '100%', height: '100%', padding: '8px'}} />
    );
  }
}
