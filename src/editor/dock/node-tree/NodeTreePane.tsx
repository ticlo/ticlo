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

interface Props {
  conn: ClientConn;
  basePaths: string[];
  hideRoot?: boolean;
  onSelect?: (keys: string[]) => void;
  showMenu?: boolean;
}

interface State {
  flowModelVisible: boolean;
  flowBasePath?: string;
  selectedKeys: string[];
}

export class NodeTreePane extends React.PureComponent<Props, State> {
  static contextType = TicloLayoutContextType;
  context!: TicloLayoutContext;

  state: State = {selectedKeys: [], flowModelVisible: false};

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
    let path = param.item.props.defaultValue;
    this.setState({flowBasePath: `${path}.`, flowModelVisible: true});
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
    this.setState({flowModelVisible: true, flowBasePath: null});
  };
  hideNewFlowModel = () => {
    this.setState({flowModelVisible: false});
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
      this.setState({flowBasePath: `${path}.`, flowModelVisible: true});
    }
  };
  render() {
    let {conn, basePaths, hideRoot, onSelect, showMenu} = this.props;
    let {selectedKeys, flowModelVisible, flowBasePath} = this.state;

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
            <AddNewFlow
              conn={conn}
              onClose={this.hideNewFlowModel}
              visible={flowModelVisible}
              basePath={flowBasePath}
            />
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
