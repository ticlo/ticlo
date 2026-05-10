import React, {MouseEventHandler} from 'react';
import {Button, Input, Modal, Radio, Tooltip, message} from 'antd';
import {
  AppstoreOutlined,
  BorderlessTableOutlined,
  CloseCircleOutlined,
  FileOutlined,
  FilterOutlined,
  HistoryOutlined,
  PlusSquareOutlined,
  SubnodeOutlined,
} from '@ant-design/icons';

import {FunctionTree} from './FunctionTree.js';
import {ClientConn, DataMap, FunctionDesc, encodeTicloName, translateEditor} from '@ticlo/core/editor.js';
import {OnFunctionClick} from './FunctionView.js';
import {RadioChangeEvent} from 'antd';
import {FunctionList} from './FunctionList.js';
import {
  TicloI18NConsumer,
  TicloLayoutContext,
  TicloLayoutContextConsumer,
  TicloLayoutContextType,
} from '../component/LayoutContext.js';
import {t} from '../component/LocalizedLabel.js';

interface Props {
  conn: ClientConn;
  showPreset?: boolean;
  onFunctionClick?: OnFunctionClick;
  onClick?: React.MouseEventHandler;
  filter?: (desc: FunctionDesc) => boolean;
  useFlow?: boolean;
  currentValue?: unknown;
  funcLib?: string;
}

interface State {
  tab: string;
  search: string;
  modelVisible: boolean;
  newFunctionName: string;
}

export class FunctionSelect extends React.PureComponent<Props, State> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  state = {tab: 'tree', search: '', modelVisible: false, newFunctionName: ''};

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
    this.setState({newFunctionName: (e.target as HTMLInputElement).value});
  };
  onAddFunction = () => {
    this.setState({modelVisible: true});
  };
  onAddFunctionOk = () => {
    // TODO validate function name;
    const {newFunctionName} = this.state;
    if (newFunctionName) {
      const {conn, funcLib} = this.props;
      const isGlobal = newFunctionName.startsWith('+');
      const funcId = isGlobal ? newFunctionName : `:${newFunctionName}`;
      const editPath = `#temp.#edit-${encodeTicloName(funcId)}`;
      conn.editWorker(
        editPath,
        undefined,
        funcId,
        {'#inputs': {'#is': ''}, '#outputs': {'#is': ''}},
        isGlobal ? undefined : funcLib
      );
      this.context.editFlow(editPath, () => {
        conn.applyFlowChange(editPath);
      });

      this.setState({modelVisible: false, newFunctionName: ''});
    } else {
      message.error('Invalid function name.');
    }
  };
  onAddFunctionCancel = () => {
    this.setState({modelVisible: false});
  };
  onSubflowClick = () => {
    const {currentValue, onFunctionClick} = this.props;
    if (currentValue !== '') {
      onFunctionClick('', {name: '', id: '#'}, null);
    }
  };
  onInlineClick = () => {
    const {currentValue, onFunctionClick} = this.props;
    if (!currentValue || currentValue.constructor !== Object) {
      this.props.onFunctionClick('', {name: 'inline', id: '{}'}, null);
    }
  };
  render() {
    const {conn, showPreset, onFunctionClick, onClick, filter, useFlow, currentValue, funcLib} = this.props;
    const {tab, search, modelVisible, newFunctionName} = this.state;

    if (!conn) {
      return <div />;
    }
    return (
      <div className="ticl-func-select" onClick={onClick}>
        <div className="tlcl-top-menu-box ticl-hbox">
          <Radio.Group defaultValue="tree" size="small" onChange={this.onToggleChange}>
            <Tooltip title={t('In-Flow')}>
              <Radio.Button value="inFlow">
                <FileOutlined />
              </Radio.Button>
            </Tooltip>
            <Tooltip title={t('Global')}>
              <Radio.Button value="tree">
                <AppstoreOutlined />
              </Radio.Button>
            </Tooltip>
            <Tooltip title={t('Recent')}>
              <Radio.Button value="recent">
                <HistoryOutlined />
              </Radio.Button>
            </Tooltip>
          </Radio.Group>
          <TicloI18NConsumer>
            {() => (
              <Input
                size="small"
                value={search}
                placeholder={translateEditor('Search')}
                style={{display: tab === 'tree' || tab === 'inFlow' ? '' : 'none'}}
                onChange={this.onFilterChange}
                suffix={
                  search ? (
                    <CloseCircleOutlined
                      title={'clear'}
                      style={{color: 'rgba(0,0,0,.45)'}}
                      onClick={this.onFilterClear}
                    />
                  ) : (
                    <FilterOutlined style={{color: 'rgba(0,0,0,.45)'}} />
                  )
                }
              />
            )}
          </TicloI18NConsumer>
          {this.context?.editFlow ? (
            <Tooltip title={t('Add Function')}>
              <Button size="small" onClick={this.onAddFunction} icon={<PlusSquareOutlined />} />
            </Tooltip>
          ) : null}
          <Modal
            title={t('Function Name?')}
            open={this.state.modelVisible}
            onOk={this.onAddFunctionOk}
            onCancel={this.onAddFunctionCancel}
          >
            <Input size="small" value={newFunctionName} onChange={this.onFunctionNameChange} />
          </Modal>
        </div>
        {useFlow && (
          <>
            <Button
              type={currentValue === '#' ? 'primary' : 'default'}
              icon={<SubnodeOutlined />}
              size="small"
              onClick={this.onSubflowClick}
            >
              {t('Subflow')}
            </Button>
            <Button
              type={typeof currentValue === 'object' ? 'primary' : 'default'}
              icon={<BorderlessTableOutlined />}
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
          funcLib={funcLib ?? ''}
          style={{display: tab === 'inFlow' ? '' : 'none'}}
        />
        <FunctionTree
          conn={conn}
          showPreset={showPreset}
          search={search}
          filter={filter}
          onFunctionClick={onFunctionClick}
          style={{display: tab === 'tree' ? '' : 'none'}}
        />
        <FunctionList
          conn={conn}
          recent={true}
          funcLib={funcLib}
          style={{display: tab === 'recent' ? '' : 'none'}}
        />
      </div>
    );
  }
}
