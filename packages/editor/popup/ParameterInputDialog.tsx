import React from 'react';
import {Modal, Button, Space} from 'antd';
import {DataMap, FunctionDesc, PropDesc} from '@ticlo/core';
import {typeEditorMap} from '../property/value/index.js';
import {ReadonlyEditor} from '../property/value/ReadonlyEditor.js';
import {LocalizedPropertyName} from '../component/LocalizedLabel.js';

interface Props {
  title: React.ReactNode | string;
  funcName: string;
  ns?: string;
  parameters: PropDesc[];
  onCancel: () => void;
  onOk: (data: DataMap) => void;
}

interface State {
  visible: boolean;
  values: DataMap;
}

export class ParameterInputDialog extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    const defaultValues: DataMap = {};
    for (const propDesc of props.parameters) {
      defaultValues[propDesc.name] = propDesc.default;
    }
    this.state = {visible: true, values: {}};
  }
  onOk = () => {
    const {onOk} = this.props;
    const {values} = this.state;
    onOk?.(values);
  };
  render() {
    const {title, parameters, funcName, ns, onCancel} = this.props;
    const {visible, values} = this.state;
    const funcDesc: FunctionDesc = {
      name: funcName,
      ns,
      properties: parameters,
    };
    console.log(funcDesc);
    const children: React.ReactElement[] = [];
    for (const propDesc of parameters) {
      const name = propDesc.name;
      const value = values[name];
      let EditorClass = typeEditorMap[propDesc.type];
      if (!EditorClass) {
        EditorClass = ReadonlyEditor;
      }
      const onChange = (val: any) => this.setState((oldState: State) => ({values: {...oldState.values, [name]: val}}));
      const editor = <EditorClass value={value} funcDesc={funcDesc} desc={propDesc} onChange={onChange} />;
      children.push(
        <div key={name} className="ticl-property">
          <div className="ticl-property-name">
            <LocalizedPropertyName desc={funcDesc} name={name} />
          </div>
          <div className="ticl-property-value">{editor}</div>
        </div>
      );
    }
    return (
      <Modal title={title} visible={visible} onCancel={onCancel} onOk={this.onOk}>
        {children}
      </Modal>
    );
  }
}
