import React from 'react';
import {Button, Dropdown} from 'antd';
import {CodeOutlined, PlusSquareOutlined, MenuOutlined} from '@ant-design/icons';
import {ValueEditorProps} from './ValueEditorBase.ts';
import {renderValue} from '../../component/renderValue.tsx';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext.ts';

export class ObjectEditor extends React.PureComponent<ValueEditorProps, any> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  createObject = () => {
    const {desc, addSubBlock} = this.props;
    addSubBlock(desc.create, null, null);
  };

  popup = () => {
    const {keys, name, desc, value} = this.props;
    this.context.editProperty(
      keys.map((key) => `${key}.${name}`),
      desc,
      value,
      'object',
      desc.readonly
    );
  };

  render() {
    const {value, desc, onChange, onConvertToHelper, onConvertToObject} = this.props;
    let editor: React.ReactNode;
    if (value === undefined && onChange && desc.create) {
      let create = desc.create;
      const colonIndex = create.indexOf(':');
      if (colonIndex > -1) {
        create = create.substring(colonIndex + 1);
      }
      editor = (
        <Button size="small" icon={<PlusSquareOutlined />} onClick={this.createObject}>
          {create}
        </Button>
      );
    } else {
      editor = <div className="ticl-e-object-editor">{renderValue(this.props.value)}</div>;
    }
    return (
      <>
        {editor}
        {onConvertToHelper || onConvertToObject ? (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'convert',
                  icon: onConvertToHelper ? <PlusSquareOutlined /> : <CodeOutlined />,
                  label: onConvertToHelper ? `Convert to ${desc.create}` : 'Convert to object value',
                },
              ],
              onClick: onConvertToHelper || onConvertToObject,
            }}
          >
            <Button
              className="ticl-e-dynamic-type-icon ticl-e-object-convert-button"
              type="text"
              size="small"
              icon={<MenuOutlined />}
              title="Object tools"
            />
          </Dropdown>
        ) : null}
        {this.context?.editProperty ? (
          <div className="ticl-e-expand-button" title={'Edit'} onClick={this.popup}>
            <div className="ticl-e-expand-icon-11" />
          </div>
        ) : null}
      </>
    );
  }
}
