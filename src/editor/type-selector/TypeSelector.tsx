import React from "react";
import {Icon, Input, Radio, Tooltip} from "antd";
import {TypeTree} from "./TypeTree";
import {ClientConnection} from "../../core/connect/ClientConnection";
import {OnTypeClick} from "./TypeView";
import {RadioChangeEvent} from "antd/lib/radio";
import {TypeList} from "./TypeList";

interface Props {
  conn: ClientConnection;
  onTypeClick?: OnTypeClick;
  onClose?: () => void;
}

interface State {
  tab: string;
  filter: string;
}

export class TypeSelect extends React.PureComponent<Props, State> {

  state = {tab: 'tree', filter: ''};

  onFilterChange = (e: React.SyntheticEvent) => {
    this.setState({filter: (e.target as HTMLInputElement).value});
  };

  onToggleChange = (value: RadioChangeEvent) => {
    this.setState({tab: value.target.value});
  };

  onTopAreaClick = () => {
    let {onClose} = this.props;
    if (onClose) {
      onClose();
    }
  };

  render() {
    let {conn, onTypeClick} = this.props;
    let {tab, filter} = this.state;

    if (!conn) {
      return <div/>;
    }
    return (
      <div className='ticl-type-select'>
        <div onMouseDown={this.onTopAreaClick}/>
        <div className='tlcl-type-select-toggle ticl-hbox'>
          <Radio.Group defaultValue="tree" size="small" onChange={this.onToggleChange}>
            <Radio.Button value="tree"><Tooltip title={'Tree'}> <Icon type='appstore'/> </Tooltip></Radio.Button>
            <Radio.Button value="recent"> <Tooltip title={'Recent'}><Icon type='history'/></Tooltip></Radio.Button>
          </Radio.Group>
          <Input size='small' placeholder={'filter'} style={{display: tab === 'tree' ? '' : 'none'}}
                 onChange={this.onFilterChange}
                 suffix={
                   <Icon type="filter" style={{color: 'rgba(0,0,0,.45)'}}/>
                 }/>
        </div>
        <TypeTree conn={conn} onTypeClick={onTypeClick} style={{display: tab === 'tree' ? '' : 'none'}}/>
        <TypeList conn={conn} recent={true} style={{display: tab === 'recent' ? '' : 'none'}}/>
      </div>
    );
  }

}