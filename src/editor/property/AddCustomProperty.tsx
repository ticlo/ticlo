import React, {ChangeEvent} from 'react';
import {Button, Input, Select, Form, Switch, InputNumber, Radio} from 'antd';
import {
  PropDesc,
  PropGroupDesc,
  ValueType,
  endsWithNumberReg,
  ClientConn,
  translateEditor as t,
} from '../../../src/core/editor';
import {LazyUpdateComponent} from '../component/LazyUpdateComponent';
import {FormInputItem, FormItem} from '../component/FormItem';

const RadioButton = Radio.Button;
const RadioGroup = Radio.Group;

const {Option} = Select;

interface Props {
  conn: ClientConn;

  onAddProperty(desc: PropDesc | PropGroupDesc): void;

  group?: string;
  onClick?: React.MouseEventHandler;
}

type CustomValueType = ValueType | 'group';

export class AddCustomPropertyMenu extends LazyUpdateComponent<Props, any> {
  formItems = {
    type: new FormItem<CustomValueType>(this, 'type', t('Type'), 'string'),
    name: new FormInputItem<string>(this, 'name', t('Name')),
    defaultLen: new FormItem<number>(this, 'defaultLen', t('Default Length'), 2),
    min: new FormItem<number>(this, 'min', t('Min')),
    max: new FormItem<number>(this, 'max', t('Max')),
    step: new FormItem<number>(this, 'step', t('Step')),
    placeholder: new FormInputItem<string>(this, 'placeholder', t('Place Holder'), ''),
    optionStr: new FormInputItem<string>(this, 'optionStr', t('Options')),
    showAlpha: new FormItem<boolean>(this, 'showAlpha', t('Show Alpha'), false),
    showTime: new FormItem<boolean>(this, 'showTime', t('Show Alpha'), false),
    pinned: new FormInputItem<boolean>(this, 'pinned', t('Pinned')),
  };

  onSubmit = (e: React.FormEvent<HTMLElement>) => {
    let {onAddProperty, group} = this.props;
    let {type, name, defaultLen, placeholder, min, max, step, optionStr, showAlpha, showTime, pinned} = this.formItems;
    e.preventDefault();

    let result: PropDesc | PropGroupDesc;

    let errors = new Map<string, string>();

    if (
      typeof name.value !== 'string' ||
      (name.value === '' &&
      type.value !== 'group' && // allow group to use empty name (default group)
        group !== '') // allow default group to have child with empty name
    ) {
      errors.set('name', t('Invalid Name'));
    } else if (group != null && name.value.match(endsWithNumberReg)) {
      errors.set('name', t('Number character not allowed'));
    }
    if (type.value === 'group') {
      if (defaultLen.value == null || !(defaultLen.value >= 0)) {
        errors.set('defaultLen', t('Error'));
      }
      result = {name: name.value, type: 'group', defaultLen: defaultLen.value};
    } else {
      result = {name: name.value, type: type.value, pinned: pinned.value};
      switch (type.value) {
        case 'number': {
          if (min.value != null) {
            if (typeof min.value !== 'number' || min.value !== min.value) {
              errors.set('min', t('Error'));
            } else {
              result.min = min.value;
            }
          }
          if (max.value != null) {
            if (typeof max.value !== 'number' || max.value !== max.value) {
              errors.set('max', t('Error'));
            } else if (result.hasOwnProperty('min') && result.min >= max.value) {
              errors.set('min', t('Error'));
              errors.set('max', t('Error'));
            } else {
              result.max = max.value;
            }
          }
          if (step.value != null) {
            if (typeof step.value !== 'number' || step.value !== step.value) {
              errors.set('step', t('Error'));
            } else {
              result.step = step.value;
            }
          }
          if (placeholder.value) {
            result.placeholder = placeholder.value;
          }
          break;
        }
        case 'string': {
          if (placeholder.value) {
            result.placeholder = placeholder.value;
          }
          break;
        }
        case 'select':
        case 'radio-button': {
          let options: string[] = optionStr.value.split(',');
          if (options.length < 2) {
            errors.set('option', t('Require more than one option'));
          } else {
            result.options = options;
          }
          break;
        }
        case 'toggle': {
          if (optionStr.value) {
            let options: string[] = optionStr.value.split(',');
            if (options.length !== 2) {
              errors.set('optionErr', t('Must have 0 or 2 options'));
            } else {
              result.options = options;
            }
          }
          break;
        }
        case 'date':
        case 'date-range': {
          result.showTime = showTime.value;
          break;
        }
        case 'color': {
          result.disableAlpha = !showAlpha.value;
          break;
        }
      }
    }

    if (errors.size === 0) {
      onAddProperty(result);
      name.onChange(''); // reset name after adding property
    }
    for (let key in this.formItems) {
      let formItem = (this.formItems as any)[key];
      if (errors.has(key)) {
        formItem.setError(errors.get(key));
      } else {
        formItem.setError(null);
      }
    }
  };

  renderImpl() {
    let {group, onClick} = this.props;
    let {type, name, defaultLen, placeholder, min, max, step, optionStr, showAlpha, showTime, pinned} = this.formItems;
    let typeValue = type.value;
    return (
      <Form onClick={onClick} className="ticl-add-custom-prop" labelCol={{span: 9}} wrapperCol={{span: 15}}>
        {name.render(<Input size="small" value={name.value} onChange={name.onInputChange} />)}
        {type.render(
          <Select size="small" value={type.value} onChange={type.onChange}>
            <Option value="number">{t('number')}</Option>
            <Option value="string">{t('string')}</Option>
            <Option value="toggle">{t('toggle')}</Option>
            <Option value="select">{t('select')}</Option>
            <Option value="radio-button">{t('radio-button')}</Option>
            <Option value="color">{t('color')}</Option>
            <Option value="date">{t('date')}</Option>
            <Option value="date-range">{t('date-range')}</Option>
            <Option value="password">{t('password')}</Option>
            <Option value="any">{t('dynamic')}</Option>
            {
              group == null ? <Option value="group">{t('group')}</Option> : null // dont add group if it's in already a group
            }
          </Select>
        )}
        {typeValue === 'group'
          ? defaultLen.render(
              <InputNumber size="small" min={0} step={1} value={defaultLen.value} onChange={defaultLen.onChange} />
            )
          : null}
        {typeValue === 'number'
          ? [
              min.render(<InputNumber size="small" value={min.value} onChange={min.onChange} />),
              max.render(<InputNumber size="small" value={max.value} onChange={max.onChange} />),
              step.render(<InputNumber size="small" value={step.value} onChange={step.onChange} min={0} />),
            ]
          : null}
        {typeValue === 'toggle' || typeValue === 'select' || typeValue === 'radio-button'
          ? optionStr.render(
              <Input
                size="small"
                placeholder={t('Comma separated')}
                value={optionStr.value}
                onChange={optionStr.onInputChange}
              />
            )
          : null}
        {typeValue === 'color'
          ? showAlpha.render(<Switch size="small" checked={showAlpha.value} onChange={showAlpha.onChange} />)
          : null}
        {typeValue === 'date' || typeValue === 'date-range'
          ? showTime.render(<Switch size="small" checked={showTime.value} onChange={showTime.onChange} />)
          : null}
        {typeValue === 'string' || typeValue === 'number'
          ? placeholder.render(<Input value={placeholder.value} size="small" onChange={placeholder.onInputChange} />)
          : null}
        {typeValue !== 'group'
          ? pinned.render(<Switch size="small" checked={pinned.value} onChange={pinned.onChange} />)
          : null}
        <Form.Item wrapperCol={{span: 15, offset: 9}}>
          <Button type="primary" htmlType="submit" onClick={this.onSubmit}>
            {t('Add Property')}
          </Button>
        </Form.Item>
      </Form>
    );
  }
}
