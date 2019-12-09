import React from 'react';
import {ValueEditorProps} from './ValueEditorBase';
import {renderValue} from '../../component/renderValue';

export class ReadonlyEditor extends React.PureComponent<ValueEditorProps, any> {
  render() {
    return <div className="ticl-readonly-editor">{renderValue(this.props.value)}</div>;
  }
}
