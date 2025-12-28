import React from 'react';
import {Button} from 'antd';
import {CaretRightOutlined, PlayCircleOutlined} from '@ant-design/icons';

import {ValueEditorProps} from './ValueEditorBase.js';
import {renderValue} from '../../component/renderValue.js';

export class EventEditor extends React.PureComponent<ValueEditorProps, any> {
  onClick = () => {
    const {conn, keys} = this.props;
    for (const key of keys) {
      conn.callFunction(key);
    }
  };

  render() {
    const {desc, value, locked, onChange} = this.props;
    const icon = onChange ? <CaretRightOutlined /> : <PlayCircleOutlined />;
    return (
      <Button
        size="small"
        icon={icon}
        shape={value != null ? 'round' : undefined}
        disabled={onChange == null}
        onClick={this.onClick}
      >
        {renderValue(value)}
      </Button>
    );
  }
}
