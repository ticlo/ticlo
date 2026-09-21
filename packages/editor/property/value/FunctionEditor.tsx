import React from 'react';
import {Input} from 'antd';
import {DownOutlined} from '@ant-design/icons';
import {FunctionDesc, PropDesc} from '@ticlo/core';
import {ValueEditorProps} from './ValueEditorBase.ts';
import {TIcon} from '../../icon/Icon.tsx';
import {DragDropDiv, DragState} from 'rc-dock';
import {StringEditorBase} from './StringEditorBase.ts';
import {FunctionSelect} from '../../function-selector/FunctionSelect.tsx';
import {addRecentFunction} from '../../function-selector/FunctionList.tsx';
import {Popup} from '../../component/ClickPopup.tsx';
import {getFuncStyleFromDesc} from '../../util/BlockColors.ts';
import {getDescLib} from '../../util/FunctionLib.ts';

interface State {
  opened: boolean;
}

export class FunctionEditor extends StringEditorBase {
  state: State = {opened: false};

  commitChange(value: string) {
    super.commitChange(value);
    if (typeof value === 'string' && this.props.conn.watchDesc(value, getDescLib(value, this.props.funcLib))) {
      addRecentFunction(value);
    }
  }

  openPopup = () => {
    if (!this.props.onChange || this.props.locked) return;
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
    if (!this.props.onChange || this.props.locked) return e.reject();
    const {conn} = this.props;
    const blockData = DragState.getData('block', conn.getBaseConn());

    if (blockData && Object.hasOwn(blockData, '#is')) {
      e.accept('');
    }
  };

  onDrop = (e: DragState) => {
    if (!this.props.onChange || this.props.locked) return;
    const {conn} = this.props;
    const blockData = DragState.getData('block', conn.getBaseConn());

    if (blockData && Object.hasOwn(blockData, '#is')) {
      this.commitChange(blockData['#is']);
    }
  };

  render() {
    let {desc, value, locked, onChange, conn, funcLib} = this.props;
    const {opened} = this.state;

    if (this._pendingValue != null) {
      value = this._pendingValue;
    } else if (locked || (typeof value === 'string' && value.startsWith('flow:'))) {
      onChange = null;
    }

    let iconName: string;
    let colorClass = 'ticl-bg--999';
    const funcDesc = conn.watchDesc(value, getDescLib(value, funcLib));
    if (funcDesc) {
      [colorClass, iconName] = getFuncStyleFromDesc(funcDesc, conn, 'ticl-bg--');
    }

    return (
      <DragDropDiv className="ticl-type-editor ticl-hbox" onDragOverT={this.onDragOver} onDropT={this.onDrop}>
        <TIcon icon={iconName} colorClass={colorClass} />
        <Popup
          popupVisible={opened && onChange != null}
          onPopupVisibleChange={this.onPopupClose}
          popup={<FunctionSelect conn={conn} onFunctionClick={this.onFunctionClick} funcLib={funcLib} />}
        >
          <Input
            value={value}
            disabled={onChange == null}
            size="small"
            onChange={this.onInputChange}
            onBlur={this.onBlur}
            onKeyDown={this.onKeyDown}
            suffix={<DownOutlined style={{color: 'rgba(0,0,0,.45)'}} onClick={onChange ? this.openPopup : null} />}
          />
        </Popup>
      </DragDropDiv>
    );
  }
}
