import React from 'react';
import {PropertyEditor, PropertyEditorProps} from './PropertyEditor.tsx';
import {Checkbox} from 'antd';
import {CheckboxChangeEvent} from 'antd';
import {OptionalPropertyReorder} from './PropertyReorder.ts';
import {EditPolicyContext} from '../component/EditPolicyContext.tsx';

interface Props extends PropertyEditorProps {
  checked: boolean;
  onCheck: (name: string, checked: boolean) => void;
}

export class OptionalPropertyEditor extends React.PureComponent<Props, any> {
  static contextType = EditPolicyContext;
  declare context: React.ContextType<typeof EditPolicyContext>;
  onChange = (event: CheckboxChangeEvent) => {
    const {onCheck, name} = this.props;
    onCheck(name, event.target.checked);
  };
  render() {
    const {checked, onCheck, reorder, ...others} = this.props;
    return (
      <div className="ticl-property-optional">
        <Checkbox
          checked={checked}
          onChange={this.onChange}
          disabled={
            !others.paths.every((path) =>
              this.context.can({cmd: checked ? 'removeOptionalProp' : 'addOptionalProp', path, name: others.name})
            )
          }
        />
        <PropertyEditor {...others} reorder={OptionalPropertyReorder} />
      </div>
    );
  }
}
