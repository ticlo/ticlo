import React from 'react';
import {Button} from 'antd';
import PlusSquareIcon from '@ant-design/icons/PlusSquareOutlined';
import {ValueEditorProps} from './ValueEditorBase';
import {renderValue} from '../../component/renderValue';
import {getDefaultFuncData} from '../../../core/block/Descriptor';

export class ObjectEditor extends React.PureComponent<ValueEditorProps, any> {
  createObject = () => {
    let {conn, keys, desc, addSubBlock} = this.props;
    addSubBlock(desc.create, null, null);
  };

  render() {
    let {value, desc, onChange} = this.props;
    if (value === undefined && onChange && desc.create) {
      return (
        <Button size="small" icon={<PlusSquareIcon />} onClick={this.createObject}>
          {desc.create}
        </Button>
      );
    } else {
      return <div className="ticl-object-editor">{renderValue(this.props.value)}</div>;
    }
  }
}
