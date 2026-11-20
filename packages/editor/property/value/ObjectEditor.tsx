import React, {useEffect, useReducer} from 'react';
import {Button, Dropdown, Select} from 'antd';
import {CodeOutlined, PlusSquareOutlined, MenuOutlined} from '@ant-design/icons';
import {ValueEditorProps} from './ValueEditorBase.ts';
import {renderValue} from '../../component/renderValue.tsx';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext.ts';

import {useEditPolicy} from '../../component/EditPolicyContext.tsx';
import {LocalizedFunctionName, t} from '../../component/LocalizedLabel.tsx';
import {getDescModule} from '../../util/FunctionModule.ts';

function HelperTypeSelect({
  conn,
  create,
  addSubBlock,
  keys,
  name,
  funcModule,
}: Pick<ValueEditorProps, 'conn' | 'addSubBlock' | 'keys' | 'name' | 'funcModule'> & {create: readonly string[]}) {
  const policy = useEditPolicy();
  const [, redraw] = useReducer((version: number) => version + 1, 0);

  useEffect(() => {
    if (!conn) return;
    const listeners = create.map((id) => {
      const listener = () => redraw();
      conn.watchDesc(id, getDescModule(id, funcModule), listener);
      return listener;
    });
    return () => listeners.forEach((listener) => conn.unwatchDesc(listener));
  }, [conn, create, funcModule]);

  const options = create.map((id) => {
    const helper = conn?.watchDesc(id, getDescModule(id, funcModule));
    return {
      value: id,
      label: helper ? <LocalizedFunctionName desc={helper} /> : id,
      disabled: !helper || !keys?.every((path) => policy.canCreateBlock(`${path}.~${name}`, id)),
    };
  });
  return (
    <Select
      size="small"
      placeholder={t('Create helper')}
      options={options}
      disabled={!options.some((option) => !option.disabled)}
      onChange={(id: string) => {
        if (options.some((option) => option.value === id && !option.disabled)) addSubBlock(id);
      }}
    />
  );
}

export class ObjectEditor extends React.PureComponent<ValueEditorProps, any> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  createObject = () => {
    const {desc, addSubBlock} = this.props;
    if (typeof desc.create === 'string') addSubBlock(desc.create, null, null);
  };

  popup = () => {
    const {keys, name, desc, value, inline, onEditValue} = this.props;
    if (inline) {
      onEditValue?.(desc, 'object');
      return;
    }
    this.context.editProperty(
      keys.map((key) => `${key}.${name}`),
      desc,
      value,
      'object',
      desc.readonly
    );
  };

  render() {
    const {value, desc, inline, addSubBlock, onEditValue, onChange, onConvertToHelper, onConvertToObject, locked} =
      this.props;
    let editor: React.ReactNode;
    if (value === undefined && onChange && addSubBlock && Array.isArray(desc.create) && desc.create.length && !locked) {
      editor = <HelperTypeSelect {...this.props} create={desc.create} />;
    } else if (value === undefined && onChange && typeof desc.create === 'string' && desc.create && addSubBlock) {
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
        {(inline ? onEditValue : this.context?.editProperty) ? (
          <div className="ticl-e-expand-button" title={'Edit'} onClick={this.popup}>
            <div className="ticl-e-expand-icon-11" />
          </div>
        ) : null}
      </>
    );
  }
}
