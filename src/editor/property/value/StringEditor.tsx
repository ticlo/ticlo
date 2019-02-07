import * as React from "react";
import {Input} from "antd";
import {PropDesc} from "../../../common/block/Descriptor";

const {TextArea} = Input;

interface TextAreaRef {
  textAreaRef: HTMLTextAreaElement;

  resizeOnNextFrame(): void;
}

interface Props {
  value: any;
  desc: PropDesc;
  onChange: (value: any) => void;
}

export class StringEditor extends React.Component<Props, any> {

  _serverValue: string;
  _pendingValue: string = null;

  _textAreaRef: TextAreaRef;

  getTextArea = (ref: any) => {
    this._textAreaRef = ref;
  };

  constructor(props: Props) {
    super(props);
    this._serverValue = props.value;
  }

  shouldComponentUpdate(nextProps: Readonly<Props>, nextState: Readonly<any>, nextContext: any) {
    let props = this.props;
    if (props.value !== nextProps.value) {
      this._serverValue = nextProps.value;
      // only render when there is no pendingValue (pending is NaN)
      if (this._pendingValue == null) {
        if (this._textAreaRef.textAreaRef) {
          this._textAreaRef.textAreaRef.value = nextProps.value;
          this._textAreaRef.resizeOnNextFrame();
        }
      }
    }
    if (props.desc !== nextProps.desc) {
      return true;
    }
    if (props.onChange !== nextProps.onChange) {
      return true;
    }

    return false;
  }

  commitChange(value: string) {
    this._pendingValue = null;
    this._serverValue = value;
    this.props.onChange(value);
  }

  onValueChange = (e: React.SyntheticEvent) => {
    let value = (e.nativeEvent.target as HTMLTextAreaElement).value;
    if (this._pendingTyping) {
      if (typeof value === 'string') {
        if (value !== this._serverValue || this._pendingValue != null) {
          // when pending value already exists or server value is not the same
          this._pendingValue = value;
        }
      }
      this._pendingTyping = false;
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
        this._textAreaRef.textAreaRef.value = this._serverValue;
        this._pendingValue = null;
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
    if (this._pendingValue != null) {
      value = this._pendingValue;
    }
    return (
      <TextArea ref={this.getTextArea} placeholder={desc.placeholder} defaultValue={value} disabled={onChange == null}
                autosize={{minRows: 1, maxRows: 5}}
                onChange={this.onValueChange} onBlur={this.onBlur} onKeyDown={this.onKeyDown}/>
    );
  }
}