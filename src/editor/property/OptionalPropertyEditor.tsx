import React from 'react';
import {PropertyEditor, PropertyEditorProps} from './PropertyEditor';
import {Checkbox} from 'antd';
import {CheckboxChangeEvent} from 'antd/lib/checkbox';

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
    let {checked, onCheck, ...others} = this.props;
    return (
      <div className="ticl-property-optional">
        <Checkbox checked={checked} onChange={this.onChange} />
        <PropertyEditor {...others} />
      </div>
    );
  }
}
