import React from 'react';
import {Button} from 'antd';
import PlayIcon from '@ant-design/icons/CaretRightOutlined';
import PlayCircleOutlined from '@ant-design/icons/PlayCircleOutlined';
import PlayCircleFilled from '@ant-design/icons/PlayCircleFilled';
import {ValueEditorProps} from './ValueEditorBase';

export class EventEditor extends React.PureComponent<ValueEditorProps, any> {
  onClick = () => {
    const {conn, keys} = this.props;
    for (const key of keys) {
      conn.callFunction(key);
    }
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    let IconClass = PlayIcon;
    if (!onChange) {
      // read only event
      IconClass = value == null ? PlayCircleOutlined : PlayCircleFilled;
    }
    return (
      <Button
        icon={<IconClass />}
        type={onChange ? undefined : 'dashed'}
        disabled={onChange == null}
        onClick={this.onClick}
      >
        {value}
      </Button>
    );
  }
}
