import React, {ChangeEvent} from 'react';
import {ClientConn, decode} from '../../../../src/core/editor';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext';
import {NodeTree} from '../..';
import {Button, Input, Modal, Tooltip} from 'antd';
import FileAddIcon from '@ant-design/icons/FileAddOutlined';
import ReloadIcon from '@ant-design/icons/ReloadOutlined';
import {AddNewJob} from './AddNewJob';
const {TextArea} = Input;

interface Props {
  conn: ClientConn;
  basePaths: string[];
  hideRoot?: boolean;
  onSelect?: (keys: string[]) => void;
  showMenu?: boolean;
}

interface State {
  jobModelVisible: boolean;
  selectedKeys: string[];
}

export class NodeTreePane extends React.PureComponent<Props, State> {
  static contextType = TicloLayoutContextType;
  context!: TicloLayoutContext;

  state: State = {selectedKeys: [], jobModelVisible: false};

  _nodeTree: NodeTree;
  getNodeTree = (ref: NodeTree) => {
    this._nodeTree = ref;
  };

  onChange(selectedKeys: string[]) {
    this.setState({selectedKeys});
  }

  onSourceChange(source: any): void {}

  componentDidMount(): void {
    this.context?.selectedPaths.listen(this);
  }
  componentWillUnmount(): void {
    this.context?.selectedPaths.unlisten(this);
  }

  reload = () => {
    this._nodeTree?.reload();
  };

  showNewJobModel = () => {
    this.setState({jobModelVisible: true});
  };
  hideNewJobModel = () => {
    this.setState({jobModelVisible: false});
  };

  render() {
    let {conn, basePaths, hideRoot, onSelect, showMenu} = this.props;
    let {selectedKeys, jobModelVisible} = this.state;

    return (
      <div className="ticl-node-tree-pane">
        {showMenu ? (
          <div className="tlcl-top-menu-box ticl-hbox">
            <Tooltip title="Reload">
              <Button size="small" icon={<ReloadIcon />} onClick={this.reload} />
            </Tooltip>
            <Tooltip title="New Job">
              <Button size="small" icon={<FileAddIcon />} onClick={this.showNewJobModel} />
            </Tooltip>
            <AddNewJob conn={conn} onClose={this.hideNewJobModel} visible={jobModelVisible} />
          </div>
        ) : null}
        <NodeTree
          ref={this.getNodeTree}
          conn={conn}
          basePaths={basePaths}
          hideRoot={hideRoot}
          selectedKeys={selectedKeys || []}
          onSelect={onSelect}
        />
      </div>
    );
  }
}
