import React, {MouseEventHandler} from 'react';
import {Button, Input, Modal, Radio, Tooltip, message} from 'antd';
import AppStoreIcon from '@ant-design/icons/AppstoreOutlined';
import HistoryIcon from '@ant-design/icons/HistoryOutlined';
import CloseCircleIcon from '@ant-design/icons/CloseCircleOutlined';
import FilterIcon from '@ant-design/icons/FilterOutlined';
import PlusSquareIcon from '@ant-design/icons/PlusSquareOutlined';
import SubnodeIcon from '@ant-design/icons/SubnodeOutlined';
import InlineIcon from '@ant-design/icons/BorderlessTableOutlined';
import {FunctionTree} from './FunctionTree';
import {ClientConn, DataMap, FunctionDesc, encodeTicloName, translateEditor} from '@ticlo/core/editor';
import {OnFunctionClick} from './FunctionView';
import {RadioChangeEvent} from 'antd/lib/radio';
import {FunctionList} from './FunctionList';
import {
  TicloI18NConsumer,
  TicloLayoutContext,
  TicloLayoutContextConsumer,
  TicloLayoutContextType,
} from '../component/LayoutContext';
import {t} from '../component/LocalizedLabel';

interface Props {
  conn: ClientConn;
  showPreset?: boolean;
  onFunctionClick?: OnFunctionClick;
  onClick?: React.MouseEventHandler;
  filter?: (desc: FunctionDesc) => boolean;
  useFlow?: boolean;
  currentValue?: unknown;
}

interface State {
  tab: string;
  search: string;
  modelVisible: boolean;
}

export class FunctionSelect extends React.PureComponent<Props, State> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

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
  onSubflowClick = () => {
    let {currentValue, onFunctionClick} = this.props;
    if (currentValue !== '') {
      onFunctionClick('', {name: '', id: '#'}, null);
    }
  };
  onInlineClick = () => {
    let {currentValue, onFunctionClick} = this.props;
    if (!currentValue || currentValue.constructor !== Object) {
      this.props.onFunctionClick('', {name: 'inline', id: '{}'}, null);
    }
  };
  render() {
    let {conn, showPreset, onFunctionClick, onClick, filter, useFlow, currentValue} = this.props;
    let {tab, search, modelVisible} = this.state;

    if (!conn) {
      return <div />;
    }
    return (
      <div className="ticl-func-select" onClick={onClick}>
        <div className="tlcl-top-menu-box ticl-hbox">
          <Radio.Group defaultValue="tree" size="small" onChange={this.onToggleChange}>
            <Tooltip title={t('Function Tree')}>
              <Radio.Button value="tree">
                <AppStoreIcon />
              </Radio.Button>
            </Tooltip>
            <Tooltip title={t('Recent')}>
              <Radio.Button value="recent">
                <HistoryIcon />
              </Radio.Button>
            </Tooltip>
          </Radio.Group>
          <TicloI18NConsumer>
            {() => (
              <Input
                size="small"
                value={search}
                placeholder={translateEditor('Search')}
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
            )}
          </TicloI18NConsumer>
          {this.context?.editFlow ? (
            <Tooltip title={t('Add Function')}>
              <Button size="small" onClick={this.onAddFunction} icon={<PlusSquareIcon />} />
            </Tooltip>
          ) : null}
          <Modal
            title={t('Function Name?')}
            open={this.state.modelVisible}
            onOk={this.onAddFunctionOk}
            onCancel={this.onAddFunctionCancel}
          >
            <Input size="small" defaultValue={this.newFunctionName} onChange={this.onFunctionNameChange} />
          </Modal>
        </div>
        {useFlow && (
          <>
            <Button
              type={currentValue === '#' ? 'primary' : 'default'}
              icon={<SubnodeIcon />}
              size="small"
              onClick={this.onSubflowClick}
            >
              {t('Subflow')}
            </Button>
            <Button
              type={typeof currentValue === 'object' ? 'primary' : 'default'}
              icon={<InlineIcon />}
              size="small"
              onClick={this.onInlineClick}
            >
              {t('Inline')}
            </Button>
          </>
        )}
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
