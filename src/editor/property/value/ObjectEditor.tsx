import React from 'react';
import {Button} from 'antd';
import PlusSquareIcon from '@ant-design/icons/PlusSquareOutlined';
import {ValueEditorProps} from './ValueEditorBase';
import {renderValue} from '../../component/renderValue';
import {getDefaultFuncData} from '../../../../src/core/editor';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext';

export class ObjectEditor extends React.PureComponent<ValueEditorProps, any> {
  static contextType = TicloLayoutContextType;
  context!: TicloLayoutContext;

  createObject = () => {
    let {conn, keys, desc, addSubBlock} = this.props;
    addSubBlock(desc.create, null, null);
  };

  popup = () => {
    let {keys, name, desc, value, locked} = this.props;
    this.context.editProperty(
      keys.map((key) => `${key}.${name}`),
      desc,
      value,
      'object',
      locked
    );
  };

  render() {
    let {value, desc, onChange} = this.props;
    let editor: React.ReactNode;
    if (value === undefined && onChange && desc.create) {
      editor = (
        <Button size="small" icon={<PlusSquareIcon />} onClick={this.createObject}>
          {desc.create}
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
