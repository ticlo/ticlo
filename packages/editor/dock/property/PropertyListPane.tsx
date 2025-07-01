import React, {ReactNode} from 'react';
import {BlockStage, PropertyList} from '../..';
import {ClientConn} from '@ticlo/core/editor';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext';

interface Props {
  conn: ClientConn;
}

interface State {
  selectedPaths: string[];
}

export class PropertyListPane extends React.PureComponent<Props, State> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  state: State = {selectedPaths: []};

  onChange(selectedPaths: string[]) {
    this.setState({selectedPaths});
  }

  onSourceChange(source: any): void {}

  componentDidMount(): void {
    this.context?.getSelectedPaths().listen(this);
  }
  componentWillUnmount(): void {
    this.context?.getSelectedPaths().unlisten(this);
  }

  render() {
    let {conn} = this.props;
    let {selectedPaths} = this.state;

    return (
      <PropertyList conn={conn} paths={selectedPaths || []} style={{width: '100%', height: '100%', padding: '8px'}} />
    );
  }
}
