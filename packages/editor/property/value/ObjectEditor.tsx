import React from 'react';
import {Button} from 'antd';
import {PlusSquareOutlined} from '@ant-design/icons';
import {ValueEditorProps} from './ValueEditorBase.js';
import {renderValue} from '../../component/renderValue.js';
import {getDefaultFuncData} from '@ticlo/core';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext.js';

export class ObjectEditor extends React.PureComponent<ValueEditorProps, any> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  createObject = () => {
    let {conn, keys, desc, addSubBlock} = this.props;
    addSubBlock(desc.create, null, null);
  };

  popup = () => {
    let {keys, name, desc, value} = this.props;
    this.context.editProperty(
      keys.map((key) => `${key}.${name}`),
      desc,
      value,
      'object',
      desc.readonly
    );
  };

  render() {
    let {value, desc, onChange} = this.props;
    let editor: React.ReactNode;
    if (value === undefined && onChange && desc.create) {
      let create = desc.create;
      let colonIndex = create.indexOf(':');
      if (colonIndex > -1) {
        create = create.substring(colonIndex + 1);
      }
      editor = (
        <Button size="small" icon={<PlusSquareOutlined />} onClick={this.createObject}>
          {create}
        </Button>
      );
    } else {
      editor = <div className="ticl-object-editor">{renderValue(this.props.value)}</div>;
    }
    if (this.context?.editProperty) {
      return (
        <>
          {editor}
          <div className="ticl-expand-button" title={'Edit'} onClick={this.popup}>
            <div className="ticl-expand-icon-11" />
          </div>
        </>
      );
    }
    return editor;
  }
}
