import React from 'react';
import {Button} from '@blueprintjs/core';
import {ValueEditorProps} from './ValueEditorBase';
import {renderValue} from '../../component/renderValue';

export class EventEditor extends React.PureComponent<ValueEditorProps, any> {
  onClick = () => {
    const {conn, keys} = this.props;
    for (const key of keys) {
      conn.callFunction(key);
    }
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    const icon = 'play';
    return (
      <Button
        className={value != null ? 'ticl-rounded-btn' : undefined}
        size="small"
        icon={icon}
        disabled={onChange == null}
        onClick={this.onClick}
      >
        {renderValue(value)}
      </Button>
    );
  }
}
