import React from 'react';
import {NodeTree} from '../../editor';
import {ClientConn} from '../../core/connect/ClientConn';
import {TicloLayoutContext, TicloLayoutContextType} from '../../editor/component/LayoutContext';

interface Props {
  conn: ClientConn;
  basePaths: string[];
  hideRoot?: boolean;
  onSelect?: (keys: string[]) => void;
}

interface State {
  selectedKeys: string[];
}

export class NodeTreeTab extends React.PureComponent<Props, State> {
  static contextType = TicloLayoutContextType;
  context!: TicloLayoutContext;

  state: State = {selectedKeys: []};

  onChange(selectedKeys: string[]) {
    this.setState({selectedKeys});
  }

  onSourceChange(source: any): void {}

  componentDidMount(): void {
    // tslint:disable-next-line
    this.context.selectedPaths.listen(this);
  }

  render() {
    let {conn, basePaths, hideRoot, onSelect} = this.props;
    let {selectedKeys} = this.state;

    return (
      <NodeTree
        conn={conn}
        basePaths={basePaths}
        hideRoot={hideRoot}
        selectedKeys={selectedKeys || []}
        onSelect={onSelect}
        style={{width: '100%', height: '100%', padding: '8px'}}
      />
    );
  }
}
