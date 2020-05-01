import React, {MouseEventHandler} from 'react';
import {Button, Input, Modal, Radio, Tooltip, message} from 'antd';
import AppStoreIcon from '@ant-design/icons/AppstoreOutlined';
import HistoryIcon from '@ant-design/icons/HistoryOutlined';
import CloseCircleIcon from '@ant-design/icons/CloseCircleOutlined';
import FilterIcon from '@ant-design/icons/FilterOutlined';
import PlusSquareIcon from '@ant-design/icons/PlusSquareOutlined';
import {FunctionTree} from './FunctionTree';
import {ClientConn, DataMap, FunctionDesc, encodeTicloName} from '../../../src/core/editor';
import {OnFunctionClick} from './FunctionView';
import {RadioChangeEvent} from 'antd/lib/radio';
import {FunctionList} from './FunctionList';
import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext';

interface Props {
  conn: ClientConn;
  showPreset?: boolean;
  onFunctionClick?: OnFunctionClick;
  onClick?: React.MouseEventHandler;
  filter?: (desc: FunctionDesc) => boolean;
}

interface State {
  tab: string;
  search: string;
  modelVisible: boolean;
}

export class FunctionSelect extends React.PureComponent<Props, State> {
  static contextType = TicloLayoutContextType;
  context!: TicloLayoutContext;

  state = {tab: 'tree', search: '', modelVisible: false};
  newFunctionName: string = '';

  onFilterChange = (e: React.SyntheticEvent) => {
    this.setState({search: (e.target as HTMLInputElement).value});
  };
  onFilterClear = () => {
    this.setState({search: ''});
  };

  onToggleChange = (value: RadioChangeEvent) => {
    this.setState({tab: value.target.value as string});
  };

  onFunctionNameChange = (e: React.SyntheticEvent) => {
    this.newFunctionName = (e.target as HTMLInputElement).value;
  };
  onAddFunction = () => {
    this.setState({modelVisible: true});
  };
  onAddFunctionOk = () => {
    // TODO validate function name;
    if (this.newFunctionName) {
      let {conn} = this.props;
      let funcId = `:${this.newFunctionName}`;
      let editPath = `#temp.#edit-${encodeTicloName(funcId)}`;
      conn.editWorker(editPath, null, funcId, {'#inputs': {'#is': ''}, '#outputs': {'#is': ''}});
      this.context.editFlow(editPath, () => {
        conn.applyFlowChange(editPath);
      });

      this.newFunctionName = '';
      this.setState({modelVisible: false});
    } else {
      message.error('Invalid function name.');
    }
  };
  onAddFunctionCancel = () => {
    this.setState({modelVisible: false});
  };
  render() {
    let {conn, showPreset, onFunctionClick, onClick, filter} = this.props;
    let {tab, search, modelVisible} = this.state;

    if (!conn) {
      return <div />;
    }
    return (
      <div className="ticl-func-select" onClick={onClick}>
        <div className="tlcl-top-menu-box ticl-hbox">
          <Radio.Group defaultValue="tree" size="small" onChange={this.onToggleChange}>
            <Tooltip title={'Tree'}>
              <Radio.Button value="tree">
                <AppStoreIcon />
              </Radio.Button>
            </Tooltip>
            <Tooltip title={'Recent'}>
              <Radio.Button value="recent">
                <HistoryIcon />
              </Radio.Button>
            </Tooltip>
          </Radio.Group>
          <Input
            size="small"
            value={search}
            placeholder={'search'}
            style={{display: tab === 'tree' ? '' : 'none'}}
            onChange={this.onFilterChange}
            suffix={
              search ? (
                <CloseCircleIcon title={'clear'} style={{color: 'rgba(0,0,0,.45)'}} onClick={this.onFilterClear} />
              ) : (
                <FilterIcon style={{color: 'rgba(0,0,0,.45)'}} />
              )
            }
          />
          {this.context?.editFlow ? (
            <Tooltip title={'New'}>
              <Button size="small" onClick={this.onAddFunction} icon={<PlusSquareIcon />} />
            </Tooltip>
          ) : null}
          <Modal
            title="Function Name?"
            visible={this.state.modelVisible}
            onOk={this.onAddFunctionOk}
            onCancel={this.onAddFunctionCancel}
          >
            <Input size="small" defaultValue={this.newFunctionName} onChange={this.onFunctionNameChange} />
          </Modal>
        </div>
        <FunctionTree
          conn={conn}
          showPreset={showPreset}
          search={search}
          filter={filter}
          onFunctionClick={onFunctionClick}
          style={{display: tab === 'tree' ? '' : 'none'}}
        />
        <FunctionList conn={conn} recent={true} style={{display: tab === 'recent' ? '' : 'none'}} />
      </div>
    );
  }
}
