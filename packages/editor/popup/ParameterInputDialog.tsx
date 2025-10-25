import React from 'react';
import {Modal} from 'antd';
import {DataMap, FunctionDesc, PropDesc} from '@ticlo/core';
import {typeEditorMap} from '../property/value';
import {ReadonlyEditor} from '../property/value/ReadonlyEditor';
import {LocalizedPropertyName} from '../component/LocalizedLabel';

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
    let defaultValues: DataMap = {};
    for (let propDesc of props.parameters) {
      defaultValues[propDesc.name] = propDesc.default;
    }
    this.state = {visible: true, values: {}};
  }
  onOk = () => {
    let {onOk} = this.props;
    let {values} = this.state;
    onOk?.(values);
  };
  render() {
    let {title, parameters, funcName, ns, onCancel} = this.props;
    let {visible, values} = this.state;
    let funcDesc: FunctionDesc = {
      name: funcName,
      ns,
      properties: parameters,
    };
    console.log(funcDesc);
    let children: React.ReactElement[] = [];
    for (let propDesc of parameters) {
      let name = propDesc.name;
      let value = values[name];
      let EditorClass = typeEditorMap[propDesc.type];
      if (!EditorClass) {
        EditorClass = ReadonlyEditor;
      }
      let onChange = (val: any) => this.setState((oldState: State) => ({values: {...oldState.values, [name]: val}}));
      let editor = <EditorClass value={value} funcDesc={funcDesc} desc={propDesc} onChange={onChange} />;
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
