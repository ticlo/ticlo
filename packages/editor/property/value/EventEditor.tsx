import React from 'react';
import {Button} from 'antd';
import {CaretRightOutlined as PlayIcon} from '@ant-design/icons';
import {PlayCircleOutlined as PlayCircleOutlined} from '@ant-design/icons';
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
    let {desc, value, locked, onChange} = this.props;
    let icon = onChange ? <PlayIcon /> : <PlayCircleOutlined />;
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
