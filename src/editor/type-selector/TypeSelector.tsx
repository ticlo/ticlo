import React, {MouseEventHandler} from 'react';
import {Button, Input, Modal, Radio, Tooltip, message} from 'antd';
import AppStoreIcon from '@ant-design/icons/AppstoreOutlined';
import HistoryIcon from '@ant-design/icons/HistoryOutlined';
import CloseCircleIcon from '@ant-design/icons/CloseCircleOutlined';
import FilterIcon from '@ant-design/icons/FilterOutlined';
import PlusSquareIcon from '@ant-design/icons/PlusSquareOutlined';
import {TypeTree} from './TypeTree';
import {ClientConn, DataMap, FunctionDesc} from '../../../src/core/editor';
import {OnTypeClick} from './TypeView';
import {RadioChangeEvent} from 'antd/lib/radio';
import {TypeList} from './TypeList';
import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext';
import {ClientCallbacks} from '../../core/connect/ClientRequests';

interface Props {
  conn: ClientConn;
  showPreset?: boolean;
  onTypeClick?: OnTypeClick;
  onClick?: React.MouseEventHandler;
  filter?: (desc: FunctionDesc) => boolean;
}

interface State {
  tab: string;
  search: string;
  modelVisible: boolean;
}

export class TypeSelect extends React.PureComponent<Props, State> {
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

  onTypeNameChange = (e: React.SyntheticEvent) => {
    this.newFunctionName = (e.target as HTMLInputElement).value;
  };
  onAddType = () => {
    this.setState({modelVisible: true});
  };
  onAddTypeOk = () => {
    // TODO validate function name;
    if (this.newFunctionName) {
      let {conn} = this.props;
      let funcId = `:${this.newFunctionName}`;
      let editPath = `#temp.#edit-${encodeURIComponent(funcId)}`;
      conn.editWorker(editPath, null, funcId, {});
      this.context.editJob(editPath, () => {
        conn.applyJobChange(editPath);
      });

      this.newFunctionName = '';
      this.setState({modelVisible: false});
    } else {
      message.error('Invalid function name.');
    }
  };
  onAddTypeCancel = () => {
    this.setState({modelVisible: false});
  };
  render() {
    let {conn, showPreset, onTypeClick, onClick, filter} = this.props;
    let {tab, search, modelVisible} = this.state;

    if (!conn) {
      return <div />;
    }
    return (
      <div className="ticl-type-select" onClick={onClick}>
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
          {this.context?.editJob ? (
            <Tooltip title={'New'}>
              <Button size="small" onClick={this.onAddType} icon={<PlusSquareIcon />} />
            </Tooltip>
          ) : null}
          <Modal
            title="Function Name?"
            visible={this.state.modelVisible}
            onOk={this.onAddTypeOk}
            onCancel={this.onAddTypeCancel}
          >
            <Input size="small" defaultValue={this.newFunctionName} onChange={this.onTypeNameChange} />
          </Modal>
        </div>
        <TypeTree
          conn={conn}
          showPreset={showPreset}
          search={search}
          filter={filter}
          onTypeClick={onTypeClick}
          style={{display: tab === 'tree' ? '' : 'none'}}
        />
        <TypeList conn={conn} recent={true} style={{display: tab === 'recent' ? '' : 'none'}} />
      </div>
    );
  }
}
