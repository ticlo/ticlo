import React, {useEffect, useReducer} from 'react';
import {Button, Dropdown, Select} from 'antd';
import {CodeOutlined, PlusSquareOutlined, MenuOutlined} from '@ant-design/icons';
import {ValueEditorProps} from './ValueEditorBase.ts';
import {renderValue} from '../../component/renderValue.tsx';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext.ts';

import {useEditPolicy} from '../../component/EditPolicyContext.tsx';
import {LocalizedFunctionName, t} from '../../component/LocalizedLabel.tsx';
import {getDescModule} from '../../util/FunctionModule.ts';

function EmbeddedBlockCreator({
  conn,
  create,
  addSubBlock,
  keys,
  name,
  funcModule,
}: Pick<ValueEditorProps, 'conn' | 'addSubBlock' | 'keys' | 'name' | 'funcModule'> & {
  create: string | readonly string[];
}) {
  const policy = useEditPolicy();
  const [, redraw] = useReducer((version: number) => version + 1, 0);

  useEffect(() => {
    if (!conn) return;
    const listeners = (typeof create === 'string' ? [create] : create).map((id) => {
      const listener = () => redraw();
      conn.watchDesc(id, getDescModule(id, funcModule), listener);
      return listener;
    });
    return () => listeners.forEach((listener) => conn.unwatchDesc(listener));
  }, [conn, create, funcModule]);

  const options = (typeof create === 'string' ? [create] : create).map((id) => {
    const embeddedBlockDesc = conn?.watchDesc(id, getDescModule(id, funcModule));
    return {
      value: id,
      label: embeddedBlockDesc ? <LocalizedFunctionName desc={embeddedBlockDesc} /> : id,
      disabled: !embeddedBlockDesc || !keys?.every((path) => policy.canCreateBlock(`${path}.~${name}`, id)),
    };
  });
  if (typeof create === 'string') {
    return (
      <Button
        size="small"
        icon={<PlusSquareOutlined />}
        disabled={options[0].disabled}
        onClick={() => addSubBlock(create)}
      >
        {create.substring(create.indexOf(':') + 1)}
      </Button>
    );
  }
  return (
    <Select
      size="small"
      prefix={<PlusSquareOutlined />}
      placeholder={t('Create')}
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
    const {
      value,
      desc,
      inline,
      addSubBlock,
      onEditValue,
      onChange,
      onConvertToEmbeddedBlock,
      onConvertToObject,
      locked,
    } = this.props;
    const editor =
      value === undefined && onChange && addSubBlock && desc.create?.length && !locked ? (
        <EmbeddedBlockCreator {...this.props} create={desc.create} />
      ) : (
        <div className="ticl-e-object-editor">{renderValue(value)}</div>
      );
    return (
      <>
        {editor}
        {onConvertToEmbeddedBlock || onConvertToObject ? (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'convert',
                  icon: onConvertToEmbeddedBlock ? <PlusSquareOutlined /> : <CodeOutlined />,
                  label: onConvertToEmbeddedBlock
                    ? `Convert to ${desc.create}`
                    : Array.isArray(value)
                      ? 'Convert to array value'
                      : 'Convert to object value',
                },
              ],
              onClick: onConvertToEmbeddedBlock || onConvertToObject,
            }}
          >
            <Button
              className={`ticl-e-object-convert-button ${inline ? 'ticl-e-square-icon-btn' : 'ticl-e-dynamic-type-icon'}`}
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
