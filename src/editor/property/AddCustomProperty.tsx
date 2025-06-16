import React, {ChangeEvent} from 'react';
import {Button, Input, Select, Form, Switch, InputNumber, Radio} from 'antd';
import {PropDesc, PropGroupDesc, ValueType, endsWithNumberReg, ClientConn, translateEditor} from '@ticlo/core/editor';
import {LazyUpdateComponent} from '../component/LazyUpdateComponent';
import {FormInputItem, FormItem} from '../component/FormItem';
import {t} from '../component/LocalizedLabel';
import {TicloI18NConsumer, TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext';
import {cacheCall} from '@ticlo/editor/util/CachedCallback';

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
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  getFormItems = cacheCall((lan: string) => ({
    type: new FormItem<CustomValueType>(this, 'type', translateEditor('Type'), 'string'),
    name: new FormInputItem<string>(this, 'name', translateEditor('Name')),
    defaultLen: new FormItem<number>(this, 'defaultLen', translateEditor('Default Length'), 2),
    min: new FormItem<number>(this, 'min', translateEditor('Min')),
    max: new FormItem<number>(this, 'max', translateEditor('Max')),
    step: new FormItem<number>(this, 'step', translateEditor('Step')),
    placeholder: new FormInputItem<string>(this, 'placeholder', translateEditor('Place Holder'), ''),
    optionStr: new FormInputItem<string>(this, 'optionStr', translateEditor('Options')),
    showAlpha: new FormItem<boolean>(this, 'showAlpha', translateEditor('Show Alpha'), false),
    showTime: new FormItem<boolean>(this, 'showTime', translateEditor('Show Alpha'), false),
    pinned: new FormInputItem<boolean>(this, 'pinned', translateEditor('Pinned'), true),
  }));

  onSubmit = (e: React.FormEvent<HTMLElement>) => {
    e.preventDefault();

    let {onAddProperty, group} = this.props;
    const formItems = this.getFormItems(this.context.language);
    let {type, name, defaultLen, placeholder, min, max, step, optionStr, showAlpha, showTime, pinned} = formItems;

    let result: PropDesc | PropGroupDesc;

    let errors = new Map<string, string>();

    if (
      typeof name.value !== 'string' ||
      (name.value === '' &&
        type.value !== 'group' && // allow group to use empty name (default group)
        group !== '') // allow default group to have child with empty name
    ) {
      errors.set('name', translateEditor('Invalid Name'));
    } else if (group != null && name.value.match(endsWithNumberReg)) {
      errors.set('name', translateEditor('Number character not allowed'));
    }
    if (type.value === 'group') {
      if (defaultLen.value == null || !(defaultLen.value >= 0)) {
        errors.set('defaultLen', translateEditor('Error'));
      }
      result = {name: name.value, type: 'group', defaultLen: defaultLen.value};
    } else {
      result = {name: name.value, type: type.value, pinned: pinned.value};
      switch (type.value) {
        case 'number': {
          if (min.value != null) {
            if (typeof min.value !== 'number' || min.value !== min.value) {
              errors.set('min', translateEditor('Error'));
            } else {
              result.min = min.value;
            }
          }
          if (max.value != null) {
            if (typeof max.value !== 'number' || max.value !== max.value) {
              errors.set('max', translateEditor('Error'));
            } else if (Object.hasOwn(result, 'min') && result.min >= max.value) {
              errors.set('min', translateEditor('Error'));
              errors.set('max', translateEditor('Error'));
            } else {
              result.max = max.value;
            }
          }
          if (step.value != null) {
            if (typeof step.value !== 'number' || step.value !== step.value) {
              errors.set('step', translateEditor('Error'));
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
            errors.set('option', translateEditor('Require more than one option'));
          } else {
            result.options = options;
          }
          break;
        }
        case 'toggle': {
          if (optionStr.value) {
            let options: string[] = optionStr.value.split(',');
            if (options.length !== 2) {
              errors.set('optionErr', translateEditor('Must have 0 or 2 options'));
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
    for (let key in formItems) {
      let formItem = (formItems as any)[key];
      if (errors.has(key)) {
        formItem.setError(errors.get(key));
      } else {
        formItem.setError(null);
      }
    }
  };

  renderImpl() {
    let {group, onClick} = this.props;
    let {type, name, defaultLen, placeholder, min, max, step, optionStr, showAlpha, showTime, pinned} =
      this.getFormItems(this.context.language);
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
              <TicloI18NConsumer>
                {() => (
                  <Input
                    size="small"
                    placeholder={translateEditor('Comma separated')}
                    value={optionStr.value}
                    onChange={optionStr.onInputChange}
                  />
                )}
              </TicloI18NConsumer>
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
