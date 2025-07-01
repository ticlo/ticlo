import React from 'react';
import {Button, Input} from 'antd';
import DownIcon from '@ant-design/icons/DownOutlined';
import EditIcon from '@ant-design/icons/EditOutlined';
import {DragDropDiv, DragState} from 'rc-dock';
import {FunctionSelect} from '../../function-selector/FunctionSelector';
import {Popup} from '../../component/ClickPopup';
import {FunctionEditor} from './FunctionEditor';
import {FunctionDesc} from '@ticlo/core';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext';
import {t} from '../../component/LocalizedLabel';
import {defaultWorkerData} from '@ticlo/core/defaults/DefaultFlows';

export class WorkerEditor extends FunctionEditor {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  static filterWorkerFunction(desc: FunctionDesc) {
    return desc.src === 'worker';
  }

  editWorker = () => {
    let {conn, keys, desc} = this.props;
    if (keys.length) {
      let flowEditorPath = `${keys[0]}.#edit-${desc.name}`;
      conn.editWorker(flowEditorPath, desc.name);
      this.context.editFlow(flowEditorPath, () => {
        conn.applyFlowChange(flowEditorPath);
      });
    }
  };

  onFunctionClick = (name: string, desc: FunctionDesc) => {
    if (desc.id === '{}') {
      const {onChange, name} = this.props;
      this._pendingValue = null;
      onChange(defaultWorkerData, name);
    } else {
      this.commitChange(desc.id);
    }

    this.setState({opened: false});
  };

  render() {
    let {desc, value, locked, onChange, conn} = this.props;
    let {opened} = this.state;

    if (this._pendingValue != null) {
      value = this._pendingValue;
    } else if (locked) {
      onChange = null;
    }

    let label: string | React.ReactNode;
    if (typeof value === 'string') {
      if (value === '#') {
        label = t('Subflow');
      } else {
        label = value;
      }
    } else if (value && value.constructor === Object) {
      label = t('Inline');
    }

    return (
      <DragDropDiv className="ticl-worker-editor ticl-hbox" onDragOverT={this.onDragOver} onDropT={this.onDrop}>
        <div className="ticl-object-editor" style={{flexGrow: 1}}>
          {label}
        </div>
        <Popup
          popupVisible={opened}
          onPopupVisibleChange={this.onPopupClose}
          popup={
            <FunctionSelect
              useFlow={true}
              conn={conn}
              onFunctionClick={this.onFunctionClick}
              filter={WorkerEditor.filterWorkerFunction}
              currentValue={value}
            />
          }
        >
          <Button className="ticl-square-icon-btn" size="small" icon={<DownIcon />} onClick={this.openPopup} />
        </Popup>
        <Button
          className="ticl-square-icon-btn"
          disabled={value == null}
          size="small"
          icon={<EditIcon />}
          onClick={this.editWorker}
        />
      </DragDropDiv>
    );
  }
}
