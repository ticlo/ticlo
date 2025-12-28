import React from 'react';
import {Button} from 'antd';
import {ValueEditorProps} from './ValueEditorBase.js';
import {renderValue} from '../../component/renderValue.js';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext.js';
import {CalendarOutlined} from '@ant-design/icons';

export class ScheduleEditor extends React.PureComponent<ValueEditorProps, any> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

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
  onClick = () => {
    const {keys, name} = this.props;
    const key0 = keys[0].split('.');
    const scheduleName = key0.pop();
    const parentPath = key0.join('.');
    const indexStr = name.match(/\d+$/)?.[0];
    const index = indexStr ? parseInt(indexStr) : undefined;
    this.context?.editSchedule(parentPath, scheduleName, index);
  };

  render() {
    const {value, desc, onChange} = this.props;
    const editor = (
      <Button
        size="small"
        icon={<CalendarOutlined />}
        disabled={onChange == null || this.context?.editSchedule == null}
        onClick={this.onClick}
      >
        {renderValue(value)}
      </Button>
    );

    if (this.context?.editProperty) {
      return (
        <>
          {editor}
          <div className="ticl-expand-button" title={'Edit'} onClick={this.popup}>
            <div className="ticl-expand-icon-11" />
          </div>
        </>
      );
    }
    return editor;
  }
}
