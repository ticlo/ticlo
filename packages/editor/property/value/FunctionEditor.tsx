import React from 'react';
import {Input} from 'antd';
import DownIcon from '@ant-design/icons/DownOutlined';
import {FunctionDesc, PropDesc} from '@ticlo/core';
import {ValueEditorProps} from './ValueEditorBase';
import {TIcon} from '../../icon/Icon';
import {DragDropDiv, DragState} from 'rc-dock';
import {StringEditorBase} from './StringEditorBase';
import {FunctionSelect} from '../../function-selector/FunctionSelector';
import {addRecentFunction} from '../../function-selector/FunctionList';
import {Popup} from '../../component/ClickPopup';
import {getFuncStyleFromDesc} from '../../util/BlockColors';

interface State {
  opened: boolean;
}

export class FunctionEditor extends StringEditorBase {
  state: State = {opened: false};

  commitChange(value: string) {
    super.commitChange(value);
    if (typeof value === 'string' && this.props.conn.watchDesc(value)) {
      addRecentFunction(value);
    }
  }

  openPopup = () => {
    this.setState({opened: true});
  };
  onPopupClose = (visible?: boolean) => {
    if (!visible) {
      this.setState({opened: false});
    }
  };

  onFunctionClick = (name: string, desc: FunctionDesc) => {
    this.commitChange(desc.id);
    this.setState({opened: false});
  };

  onDragOver = (e: DragState) => {
    let {conn} = this.props;
    let blockData = DragState.getData('block', conn.getBaseConn());

    if (blockData && Object.hasOwn(blockData, '#is')) {
      e.accept('');
    }
  };

  onDrop = (e: DragState) => {
    let {conn} = this.props;
    let blockData = DragState.getData('block', conn.getBaseConn());

    if (blockData && Object.hasOwn(blockData, '#is')) {
      this.commitChange(blockData['#is']);
    }
  };

  render() {
    let {desc, value, locked, onChange, conn} = this.props;
    let {opened} = this.state;

    if (this._pendingValue != null) {
      value = this._pendingValue;
    } else if (locked || (typeof value === 'string' && value.startsWith('flow:'))) {
      onChange = null;
    }

    let iconName: string;
    let colorClass = 'ticl-bg--999';
    let funcDesc = conn.watchDesc(value);
    if (funcDesc) {
      [colorClass, iconName] = getFuncStyleFromDesc(funcDesc, conn, 'ticl-bg--');
    }

    return (
      <DragDropDiv className="ticl-type-editor ticl-hbox" onDragOverT={this.onDragOver} onDropT={this.onDrop}>
        <TIcon icon={iconName} colorClass={colorClass} />
        <Popup
          popupVisible={opened}
          onPopupVisibleChange={this.onPopupClose}
          popup={<FunctionSelect conn={conn} onFunctionClick={this.onFunctionClick} />}
        >
          <Input
            value={value}
            disabled={onChange == null}
            size="small"
            onChange={this.onInputChange}
            onBlur={this.onBlur}
            onKeyDown={this.onKeyDown}
            suffix={<DownIcon style={{color: 'rgba(0,0,0,.45)'}} onClick={onChange ? this.openPopup : null} />}
          />
        </Popup>
      </DragDropDiv>
    );
  }
}
