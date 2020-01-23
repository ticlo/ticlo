import React from 'react';
import {Input} from 'antd';
import DownIcon from '@ant-design/icons/DownOutlined';
import {FunctionDesc, PropDesc} from '../../../../src/core/editor';
import {ValueEditorProps} from './ValueEditorBase';
import {TIcon} from '../../icon/Icon';
import {DragDropDiv, DragState} from 'rc-dock';
import {StringEditorBase} from './StringEditorBase';
import {TypeSelect} from '../../type-selector/TypeSelector';
import {addRecentType} from '../../type-selector/TypeList';
import {Popup} from '../../component/ClickPopup';
import {getFuncStyleFromDesc} from '../../util/BlockColors';

interface State {
  opened: boolean;
}

export class TypeEditor extends StringEditorBase {
  state: State = {opened: false};

  commitChange(value: string) {
    super.commitChange(value);
    if (typeof value === 'string' && this.props.conn.watchDesc(value)) {
      addRecentType(value);
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

  onTypeClick = (name: string, desc: FunctionDesc) => {
    this.commitChange(desc.id);
    this.setState({opened: false});
  };

  onDragOver = (e: DragState) => {
    let {conn} = this.props;
    let blockData = DragState.getData('block', conn.getBaseConn());

    if (blockData && blockData.hasOwnProperty('#is')) {
      e.accept('');
    }
  };

  onDrop = (e: DragState) => {
    let {conn} = this.props;
    let blockData = DragState.getData('block', conn.getBaseConn());

    if (blockData && blockData.hasOwnProperty('#is')) {
      this.commitChange(blockData['#is']);
    }
  };

  render() {
    let {desc, value, locked, onChange, conn} = this.props;
    let {opened} = this.state;

    if (this._pendingValue != null) {
      value = this._pendingValue;
    } else if (locked) {
      onChange = null;
    }

    let iconName: string;
    let iconStyle = 'tico-prn';
    let funcDesc = conn.watchDesc(value);
    if (funcDesc) {
      iconName = funcDesc.icon;
      iconStyle = getFuncStyleFromDesc(funcDesc, 'ticl-bg--');
    }
    return (
      <DragDropDiv className="ticl-type-editor ticl-hbox" onDragOverT={this.onDragOver} onDropT={this.onDrop}>
        <TIcon icon={iconName} style={iconStyle} />
        <Popup
          popupVisible={opened}
          onPopupVisibleChange={this.onPopupClose}
          popup={<TypeSelect conn={conn} onTypeClick={this.onTypeClick} />}
        >
          <Input
            value={value}
            disabled={onChange == null}
            size="small"
            onChange={this.onInputChange}
            onBlur={this.onBlur}
            onKeyDown={this.onKeyDown}
            suffix={onChange ? <DownIcon style={{color: 'rgba(0,0,0,.45)'}} onClick={this.openPopup} /> : null}
          />
        </Popup>
      </DragDropDiv>
    );
  }
}
