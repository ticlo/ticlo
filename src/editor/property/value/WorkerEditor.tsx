import React from 'react';
import {Button, Input} from 'antd';
import {DragDropDiv, DragState} from 'rc-dock';
import {TypeSelect} from '../../type-selector/TypeSelector';
import {Popup} from '../../component/ClickPopup';
import {TypeEditor} from './TypeEditor';
import {FunctionDesc} from '../../../core/block/Descriptor';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext';

export class WorkerEditor extends TypeEditor {
  static contextType = TicloLayoutContextType;
  context!: TicloLayoutContext;

  static filterWorkerFunction(desc: FunctionDesc) {
    return desc.src === 'worker';
  }

  editWorker = () => {
    let {conn, keys, desc} = this.props;
    if (keys.length) {
      let jobEditorPath = `${keys[0]}.#edit-${desc.name}`;
      conn.editWorker(jobEditorPath, desc.name);
      this.context.editJob(jobEditorPath, () => {
        conn.applyWorkerChange(jobEditorPath);
      });
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

    let label: string;
    if (typeof value === 'string') {
      label = value;
    } else if (value && value.constructor === Object) {
      label = '{}';
    }

    return (
      <DragDropDiv className="ticl-worker-editor ticl-hbox" onDragOverT={this.onDragOver} onDropT={this.onDrop}>
        <Input value={value} disabled={true} size="small" />
        <Popup
          popupVisible={opened}
          onPopupVisibleChange={this.onPopupClose}
          popup={<TypeSelect conn={conn} onTypeClick={this.onTypeClick} filter={WorkerEditor.filterWorkerFunction} />}
        >
          <Button className="ticl-square-icon-btn" size="small" icon="down" onClick={this.openPopup} />
        </Popup>
        <Button className="ticl-square-icon-btn" size="small" icon="edit" onClick={this.editWorker} />
      </DragDropDiv>
    );
  }
}
