import React, {ReactElement} from 'react';
import moment from 'moment';
import {Menu, Dropdown} from 'antd';
import {ValueEditorProps} from './ValueEditorBase';
import {ValueType} from '../../../core/block/Descriptor';
import {NumberEditor} from './NumberEditor';
import {StringEditor} from './StringEditor';
import {ToggleEditor} from './ToggleEditor';
import {ColorEditor} from './ColorEditor';
import {DateEditor} from './DateEditor';
import {DateRangeEditor} from './DateRangeEditor';
import {isColorStr} from '../../../core/util/String';
import {ClickParam} from 'antd/lib/menu';

const defaultTypes: ValueType[] = ['string', 'number', 'toggle', 'color', 'date', 'date-range', 'object', 'array'];

export const dynamicEditorMap: {[key: string]: any} = {
  'number': NumberEditor,
  'string': StringEditor,
  'toggle': ToggleEditor,
  'color': ColorEditor,
  'date': DateEditor,
  'date-range': DateRangeEditor
};

const dynamicTypeIcon: {[key: string]: React.ReactElement} = {
  'string': <div className="tico-txt">S</div>,
  'number': <div className="tico-txt">1</div>,
  'toggle': <div className="tico-txt">T</div>,
  'color': <div className="tico-txt">C</div>,
  'date': <div className="tico-txt">D</div>,
  'date-range': <div className="tico-txt">R</div>,
  'object': <div className="tico-txt tico-small-txt">{'{}'}</div>,
  'array': <div className="tico-txt tico-small-txt">[]</div>
};

const dynamicTypeMenuItem: {[key: string]: React.ReactElement} = {};
for (let type in dynamicTypeIcon) {
  dynamicTypeMenuItem[type] = (
    <Menu.Item key={type}>
      <span className="ticl-dynamic-type-menu-item">
        <div className="ticl-dynamic-type-icon">{dynamicTypeIcon[type]}</div>
        {type}
      </span>
    </Menu.Item>
  );
}

interface State {
  currentType?: ValueType;
}

export class DynamicEditor extends React.PureComponent<ValueEditorProps, State> {
  state: State = {};

  static getTypeFromValue(value: any): ValueType {
    if (value == null) {
      return null;
    }
    switch (typeof value) {
      case 'number': {
        return 'number';
      }
      case 'object': {
        if (moment.isMoment(value)) {
          return 'date';
        }
        if (Array.isArray(value)) {
          if (value.length === 2 && moment.isMoment(value[0] && moment.isMoment(value[1]))) {
            return 'date-range';
          }
          return 'array';
        }
        return 'object';
      }
      case 'string': {
        if (isColorStr(value)) {
          return 'color';
        }
        return 'string';
      }
      case 'boolean': {
        return 'toggle';
      }
    }
    return null;
  }

  onValueChange = (value: any) => {
    let {onChange} = this.props;
    let {currentType} = this.state;
    // automatically set the currentType when there is a value change
    if (!currentType) {
      this.setState({currentType: this.getCurrentType()});
    }
    onChange(value);
  };

  onMenuClick = (param: ClickParam) => {
    this.setState({currentType: param.key as ValueType});
  };

  getCurrentType(): ValueType {
    let {desc, value, onChange} = this.props;
    let {currentType} = this.state;
    let types = desc.types || defaultTypes;
    if (!onChange) {
      currentType = 'object';
    } else if (!currentType || !onChange) {
      currentType = DynamicEditor.getTypeFromValue(value);
      if (!currentType || !types.includes(currentType)) {
        // when not readonly, must use one of the allowed types
        currentType = types[0];
      }
    }

    return currentType;
  }

  render() {
    let {conn, keys, desc, value, locked, onChange} = this.props;
    let types = desc.types || defaultTypes;
    let currentType = this.getCurrentType();

    let EditorClass = dynamicEditorMap[currentType];
    let editor: React.ReactNode;
    if (EditorClass) {
      editor = (
        <EditorClass conn={conn} keys={keys} value={value} desc={desc} locked={locked} onChange={this.onValueChange}/>
      );
    }
    let typeIcon = <div className="ticl-dynamic-type-icon">{dynamicTypeIcon[currentType]}</div>;
    if (onChange && types.length > 1) {
      const menu = <Menu onClick={this.onMenuClick}>{types.map((type) => dynamicTypeMenuItem[type])}</Menu>;
      typeIcon = (
        <Dropdown overlay={menu} trigger={['click']}>
          {typeIcon}
        </Dropdown>
      );
    }

    return (
      <div className="ticl-dynamic-editor">
        {editor}
        {typeIcon}
      </div>
    );
  }
}
