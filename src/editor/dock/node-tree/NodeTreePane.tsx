import React from 'react';
import {ClientConn} from '../../../../src/core/editor';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext';
import {NodeTree} from '../..';
import {Button, Input, Menu, Tooltip} from 'antd';
import FileAddIcon from '@ant-design/icons/FileAddOutlined';
import ReloadIcon from '@ant-design/icons/ReloadOutlined';
import {AddNewFlow} from './AddNewFlow';
import {DragDropDiv, DragState} from 'rc-dock/lib';
import {NodeTreeItem} from '../../node-tree/NodeRenderer';
import {ClickParam} from 'antd/lib/menu';
import {t} from '../../component/LocalizedLabel';
import {showModal} from '../../popup/ShowModal';

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
  context!: TicloLayoutContext;

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

  onAddNewFlowClick = (param: ClickParam) => {
    let {conn} = this.props;
    let path = param.item.props.defaultValue;
    showModal(<AddNewFlow conn={conn} basePath={`${path}.`} />, this.context.showModal);
  };

  getMenu = (item: NodeTreeItem) => {
    let {showMenu} = this.props;
    let menuItems: React.ReactElement[] = [];
    if (showMenu) {
      let seekParent = item;
      while (seekParent.functionId === 'flow:main') {
        seekParent = seekParent.parent;
      }
      // find the root node, so every level of parents is Flow
      if (seekParent.id === '') {
        menuItems.push(
          <Menu.Item key="addFlow" defaultValue={item.key} onClick={this.onAddNewFlowClick}>
            <FileAddIcon />
            {t('Add Child Dataflow')}
          </Menu.Item>
        );
      }
    }
    return menuItems;
  };

  showNewFlowModel = () => {
    let {conn} = this.props;
    showModal(<AddNewFlow conn={conn} basePath={null} />, this.context.showModal);
  };

  newFlowDragOver = (e: DragState) => {
    let {conn} = this.props;
    let path = DragState.getData('path', conn.getBaseConn());
    if (path) {
      e.accept('tico-fas-plus-square');
    }
  };
  newFlowDrop = (e: DragState) => {
    let {conn} = this.props;
    let path = DragState.getData('path', conn.getBaseConn());
    if (path) {
      showModal(<AddNewFlow conn={conn} basePath={`${path}.`} />, this.context.showModal);
    }
  };
  render() {
    let {conn, basePaths, hideRoot, onSelect, showMenu} = this.props;
    let {selectedKeys} = this.state;

    return (
      <div className="ticl-node-tree-pane">
        {showMenu ? (
          <div className="tlcl-top-menu-box ticl-hbox">
            <Tooltip title={t('Reload')}>
              <Button size="small" icon={<ReloadIcon />} onClick={this.reload} />
            </Tooltip>
            <Tooltip title={t('New Dataflow')}>
              <DragDropDiv onDragOverT={this.newFlowDragOver} onDropT={this.newFlowDrop}>
                <Button size="small" icon={<FileAddIcon />} onClick={this.showNewFlowModel} />
              </DragDropDiv>
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
          getMenu={this.getMenu}
        />
      </div>
    );
  }
}
