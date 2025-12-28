import React from 'react';
import {ClientConn} from '@ticlo/core/editor.js';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext.js';
import {NodeTree} from '../../index.js';
import {Button, Input, Menu, Tooltip} from 'antd';
import {FileAddOutlined, FolderAddOutlined, ReloadOutlined} from '@ant-design/icons';

import {AddNewFlowDialog} from '../../popup/AddNewFlowDialog.js';
import {DragDrop, DragState} from 'rc-dock';
import {t} from '../../component/LocalizedLabel.js';
import {showModal} from '../../popup/ShowModal.js';

interface Props {
  conn: ClientConn;
  basePaths: string[];
  hideRoot?: boolean;
  onSelect?: (keys: string[]) => void;
  showMenu?: boolean;
}

interface State {
  selectedKeys: string[];
}

export class NodeTreePane extends React.PureComponent<Props, State> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  state: State = {selectedKeys: []};

  _nodeTree: NodeTree;
  getNodeTree = (ref: NodeTree) => {
    this._nodeTree = ref;
  };

  onChange(selectedKeys: string[]) {
    this.setState({selectedKeys});
  }

  onSourceChange(source: any): void {}

  componentDidMount(): void {
    this.context?.getSelectedPaths().listen(this);
  }
  componentWillUnmount(): void {
    this.context?.getSelectedPaths().unlisten(this);
  }

  reload = () => {
    this._nodeTree?.reload();
  };

  showNewFlowModel = () => {
    const {conn} = this.props;
    showModal(<AddNewFlowDialog conn={conn} basePath={null} />, this.context.showModal);
  };
  showNewFolderModel = () => {
    const {conn} = this.props;
    showModal(<AddNewFlowDialog conn={conn} basePath={null} isFolder={true} />, this.context.showModal);
  };

  newFlowOrFolderDragOver = (e: DragState) => {
    const {conn} = this.props;
    const functionId = DragState.getData('functionId', conn.getBaseConn());
    console.log(functionId);
    if (functionId !== 'flow:folder') {
      e.reject();
      return;
    }
    const path = DragState.getData('path', conn.getBaseConn());
    if (path) {
      e.accept('tico-fas-plus-square');
    }
  };
  newFlowDrop = (e: DragState) => {
    const {conn} = this.props;
    const path = DragState.getData('path', conn.getBaseConn());
    if (path) {
      showModal(<AddNewFlowDialog conn={conn} basePath={`${path}.`} />, this.context.showModal);
    }
  };
  newFolderDrop = (e: DragState) => {
    const {conn} = this.props;
    const path = DragState.getData('path', conn.getBaseConn());
    if (path) {
      showModal(<AddNewFlowDialog conn={conn} basePath={`${path}.`} isFolder={true} />, this.context.showModal);
    }
  };
  render() {
    const {conn, basePaths, hideRoot, onSelect, showMenu} = this.props;
    const {selectedKeys} = this.state;

    return (
      <div className="ticl-node-tree-pane">
        {showMenu ? (
          <div className="tlcl-top-menu-box ticl-hbox">
            <Tooltip title={t('Reload')}>
              <Button size="small" icon={<ReloadOutlined />} onClick={this.reload} />
            </Tooltip>
            <Tooltip title={t('New Dataflow')}>
              <DragDrop onDragOverT={this.newFlowOrFolderDragOver} onDropT={this.newFlowDrop}>
                <Button size="small" icon={<FileAddOutlined />} onClick={this.showNewFlowModel} />
              </DragDrop>
            </Tooltip>
            <Tooltip title={t('New Folder')}>
              <DragDrop onDragOverT={this.newFlowOrFolderDragOver} onDropT={this.newFolderDrop}>
                <Button size="small" icon={<FolderAddOutlined />} onClick={this.showNewFolderModel} />
              </DragDrop>
            </Tooltip>
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
