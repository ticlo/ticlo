import * as React from "react";
import {Input} from "antd";
import {PropDesc} from "../../../common/block/Descriptor";

const {TextArea} = Input;

interface Props {
  value: any;
  desc: PropDesc;
  onChange: (value: any) => void;
}

export class StringEditor extends React.PureComponent<Props, any> {

  // this is not a state bacause in commitChange() editorValue is changed but we don't want a re-render until prop change
  _pendingValue: any = null;

  constructor(props: Props) {
    super(props);
  }

  commitChange(value: string) {
    this._pendingValue = null;
    this.props.onChange(value);
  }

  onValueChange = (e: React.SyntheticEvent) => {
    let value = (e.nativeEvent.target as HTMLTextAreaElement).value;
    if (this._pendingTyping) {
      if (value !== this.props.value || this._pendingValue != null) {
        // when editorValue value already exists or server value is not the same
        this._pendingValue = value;
      }
      this._pendingTyping = false;
      this.forceUpdate();
    } else {
      this.commitChange(value);
    }
  };

  onBlur = () => {
    if (this._pendingValue != null) {
      this.commitChange(this._pendingValue);
    }
  };

  _pendingTyping = false;
  onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (this._pendingValue != null) {
        this._pendingValue = null;
        this.forceUpdate();
      }
      return;
    } else if (e.key === 'Enter' && !(e.shiftKey)) {
      this._pendingTyping = false;
      if (this._pendingValue != null) {
        this.commitChange(this._pendingValue);
      }
      e.preventDefault();
      return;
    }
    this._pendingTyping = true;
    e.stopPropagation();
  };

  render() {
    let {desc, value, onChange} = this.props;
    if (this._pendingValue != null) value = this._pendingValue;
    return (
      <TextArea placeholder={desc.placeholder} value={value}
                disabled={onChange == null}
                autosize={{minRows: 1, maxRows: 5}}
                onChange={this.onValueChange} onBlur={this.onBlur} onKeyDown={this.onKeyDown}/>
    );
  }
}