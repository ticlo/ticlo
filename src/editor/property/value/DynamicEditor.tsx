import React from 'react';
import {Menu, Dropdown} from 'antd';
import {ValueEditorProps} from './ValueEditorBase';
import {ValueType, isColorStr} from '@ticlo/core/editor';
import {NumberEditor} from './NumberEditor';
import {StringEditor} from './StringEditor';
import {ToggleEditor} from './ToggleEditor';
import {ColorEditor} from './ColorEditor';
import {DateEditor} from './DateEditor';
import {DateRangeEditor} from './DateRangeEditor';
import {ReadonlyEditor} from './ReadonlyEditor';
import {ObjectEditor} from './ObjectEditor';
import {SelectEditor} from './SelectEditor';
import {DateTime} from 'luxon';

const defaultTypes: ValueType[] = ['string', 'number', 'toggle', 'color', 'date', 'date-range', 'object', 'array'];

export const dynamicEditorMap: {[key: string]: any} = {
  'number': NumberEditor,
  'string': StringEditor,
  'toggle': ToggleEditor,
  'color': ColorEditor,
  'select': SelectEditor,
  'date': DateEditor,
  'date-range': DateRangeEditor,
  'object': ObjectEditor,
  'array': ObjectEditor,
};

const dynamicTypeIcon: {[key: string]: React.ReactElement} = {
  'string': <div className="tico-txt">' '</div>,
  'number': <div className="tico-txt">1</div>,
  'toggle': <div className="tico-txt">T</div>,
  'color': <div className="tico-txt">C</div>,
  'select': <div className="tico-txt">S</div>,
  'date': <div className="tico-txt">D</div>,
  'date-range': <div className="tico-txt">R</div>,
  'object': <div className="tico-txt tico-small-txt">{'{}'}</div>,
  'array': <div className="tico-txt tico-small-txt">[]</div>,
};

const dynamicTypeMenuItem: {[key: string]: {key: string; label: React.ReactElement}} = {};
for (let type in dynamicTypeIcon) {
  dynamicTypeMenuItem[type] = {
    key: type,
    label: (
      <div className="ticl-dynamic-type-menu-item">
        <div className="ticl-dynamic-type-icon">{dynamicTypeIcon[type]}</div>
        {type}
      </div>
    ),
  };
}

interface State {
  currentType?: ValueType;
}

export class DynamicEditor extends React.PureComponent<ValueEditorProps, State> {
  state: State = {};

  static getTypeFromValue(value: any, options?: readonly (string | number)[]): ValueType {
    if (value == null) {
      return null;
    }
    switch (typeof value) {
      case 'number': {
        return 'number';
      }
      case 'object': {
        if (DateTime.isDateTime(value)) {
          return 'date';
        }
        if (Array.isArray(value)) {
          if (value.length === 2 && DateTime.isDateTime(value[0] && DateTime.isDateTime(value[1]))) {
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
        if (options?.includes(value)) {
          return 'select';
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
    let {onChange, name} = this.props;
    let {currentType} = this.state;
    // automatically set the currentType when there is a value change
    if (!currentType) {
      this.setState({currentType: this.getCurrentType()});
    }
    onChange(value, name);
  };

  onMenuClick = (param: {key: React.Key}) => {
    this.setState({currentType: param.key as ValueType});
  };

  getCurrentType(): ValueType {
    let {desc, value, onChange} = this.props;
    let {currentType} = this.state;
    let types = desc.types || defaultTypes;
    if (!onChange) {
      currentType = 'object';
    } else if (!currentType || !onChange) {
      if (types.includes('select')) {
        currentType = DynamicEditor.getTypeFromValue(value, desc.options);
      } else {
        currentType = DynamicEditor.getTypeFromValue(value);
      }

      if (!currentType || !types.includes(currentType)) {
        // when not readonly, must use one of the allowed types
        currentType = types[0];
      }
    }

    return currentType;
  }

  render() {
    let {conn, keys, name, funcDesc, desc, value, locked, onChange, addSubBlock} = this.props;
    let types = desc.types || defaultTypes;
    let currentType = this.getCurrentType();

    let EditorClass = dynamicEditorMap[currentType];
    let editor: React.ReactNode;
    if (EditorClass) {
      editor = (
        <EditorClass
          conn={conn}
          keys={keys}
          name={name}
          value={value}
          funcDesc={funcDesc}
          desc={desc}
          locked={locked}
          onChange={this.onValueChange}
          addSubBlock={addSubBlock}
        />
      );
    }
    let typeIcon = (
      <div className="ticl-dynamic-type-icon" title={'Change Type'}>
        {dynamicTypeIcon[currentType]}
      </div>
    );
    if (onChange && types.length > 1) {
      const menu = {items: types.map((type) => dynamicTypeMenuItem[type]), onClick: this.onMenuClick};
      typeIcon = (
        <Dropdown menu={menu} trigger={['click']}>
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
