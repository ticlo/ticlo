import React, {MouseEventHandler} from 'react';
import {Input, Radio, Tooltip} from 'antd';
import AppStoreIcon from '@ant-design/icons/AppstoreOutlined';
import HistoryIcon from '@ant-design/icons/HistoryOutlined';
import CloseCircleIcon from '@ant-design/icons/CloseCircleOutlined';
import FilterIcon from '@ant-design/icons/FilterOutlined';
import {TypeTree} from './TypeTree';
import {ClientConn} from '../../core/client';
import {OnTypeClick} from './TypeView';
import {RadioChangeEvent} from 'antd/lib/radio';
import {TypeList} from './TypeList';
import {FunctionDesc} from '../../core/block/Descriptor';

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
}

export class TypeSelect extends React.PureComponent<Props, State> {
  state = {tab: 'tree', search: ''};

  onFilterChange = (e: React.SyntheticEvent) => {
    this.setState({search: (e.target as HTMLInputElement).value});
  };
  onFilterClear = () => {
    this.setState({search: ''});
  };

  onToggleChange = (value: RadioChangeEvent) => {
    this.setState({tab: value.target.value as string});
  };

  render() {
    let {conn, showPreset, onTypeClick, onClick, filter} = this.props;
    let {tab, search} = this.state;

    if (!conn) {
      return <div />;
    }
    return (
      <div className="ticl-type-select" onClick={onClick}>
        <div className="tlcl-type-select-toggle ticl-hbox">
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
