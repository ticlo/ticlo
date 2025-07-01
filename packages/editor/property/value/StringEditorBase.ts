import React from 'react';
import {Input} from 'antd';
import {ValueEditorProps} from './ValueEditorBase';

const {TextArea} = Input;

export abstract class StringEditorBase extends React.PureComponent<ValueEditorProps, any> {
  // this is not a state because in commitChange() editorValue is changed but we don't want a re-render until prop change
  _pendingValue: any = null;

  commitChange(value: string) {
    const {onChange, name} = this.props;
    this._pendingValue = null;
    onChange(value, name);
  }

  onInputChange = (e: React.SyntheticEvent) => {
    this.onValueChange((e.target as HTMLTextAreaElement | HTMLInputElement).value);
  };
  onValueChange = (value: string) => {
    if (value !== this.props.value || this._pendingValue != null) {
      // when editorValue value already exists or server value is not the same
      this._pendingValue = value;
      this.forceUpdate();
    }
  };

  onBlur = () => {
    if (this._pendingValue != null) {
      this.commitChange(this._pendingValue);
    }
  };

  onKeyDown = (e: React.KeyboardEvent) => {
    if (!e.ctrlKey && !e.metaKey) {
      // allow shortcut like ctrl+S to propagate
      e.stopPropagation();
    }
    if (e.key === 'Escape') {
      if (this._pendingValue != null) {
        this._pendingValue = null;
        this.forceUpdate();
      }
      return;
    } else if (e.key === 'Enter' && !(e.shiftKey && e.target instanceof HTMLTextAreaElement)) {
      if (this._pendingValue != null) {
        this.commitChange(this._pendingValue);
      } else {
        this.commitChange(this.props.value);
      }
      e.preventDefault();
      return;
    }
  };
}
