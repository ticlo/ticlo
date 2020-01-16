import React, {ChangeEvent} from 'react';
import {Form, InputNumber} from 'antd';
import {RadioChangeEvent} from 'antd/lib/radio';
import {LazyUpdateComponent} from './LazyUpdateComponent';

const {Item} = Form;

export class FormItem<T> {
  error: string = null;
  constructor(
    public component: {forceUpdate: () => void},
    public key: string,
    public label: string,
    public value?: T
  ) {}

  onChange = (value: T) => {
    if (value !== this.value) {
      this.value = value;
      this.component.forceUpdate();
    }
  };

  setError(error?: string) {
    if (error !== this.error) {
      this.error = error;
      this.component.forceUpdate();
    }
  }

  render(child: React.ReactElement) {
    return (
      <Item label={this.label} key={this.key} validateStatus={this.error ? 'error' : null} help={this.error}>
        {child}
      </Item>
    );
  }
}

export class FormInputItem<T> extends FormItem<T> {
  onInputChange = (change: {target: {value: T}}) => {
    this.onChange(change.target.value);
  };
}
