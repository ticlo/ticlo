import React, {MouseEventHandler} from 'react';
import {Icon, Input, Radio, Tooltip} from 'antd';
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
            <Radio.Button value="tree">
              <Tooltip title={'Tree'}>
                <Icon type="appstore" />
              </Tooltip>
            </Radio.Button>
            <Radio.Button value="recent">
              <Tooltip title={'Recent'}>
                <Icon type="history" />
              </Tooltip>
            </Radio.Button>
          </Radio.Group>
          <Input
            size="small"
            value={search}
            placeholder={'search'}
            style={{display: tab === 'tree' ? '' : 'none'}}
            onChange={this.onFilterChange}
            suffix={
              search ? (
                <Icon
                  title={'clear'}
                  type="close-circle"
                  style={{color: 'rgba(0,0,0,.45)'}}
                  onClick={this.onFilterClear}
                />
              ) : (
                <Icon type="filter" style={{color: 'rgba(0,0,0,.45)'}} />
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
