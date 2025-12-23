import React from 'react';
import {PropertyEditor, PropertyEditorProps} from './PropertyEditor.js';
import {Checkbox} from 'antd';
import {CheckboxChangeEvent} from 'antd';
import {OptionalPropertyReorder} from './PropertyReorder.js';

interface Props extends PropertyEditorProps {
  checked: boolean;
  onCheck: (name: string, checked: boolean) => void;
}

export class OptionalPropertyEditor extends React.PureComponent<Props, any> {
  onChange = (event: CheckboxChangeEvent) => {
    let {onCheck, name} = this.props;
    onCheck(name, event.target.checked);
  };
  render() {
    let {checked, onCheck, reorder, ...others} = this.props;
    return (
      <div className="ticl-property-optional">
        <Checkbox checked={checked} onChange={this.onChange} />
        <PropertyEditor {...others} reorder={OptionalPropertyReorder} />
      </div>
    );
  }
}
