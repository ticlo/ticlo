import React, {ChangeEvent} from "react";
import {Button, Input, Select, Form, Switch, InputNumber} from "antd";
import {PropDesc, PropGroupDesc, ValueType, VisibleType} from "../../core/block/Descriptor";
import {endsWithNumberReg} from "../../core/util/String";

const FormItem = Form.Item;
const {Option} = Select;

interface Props {
  onAddProperty(desc: PropDesc | PropGroupDesc): void;

  group?: string;
  onClick?: React.MouseEventHandler;
}

type MoreValueType = ValueType | 'group';

interface State {
  name: string;
  type: MoreValueType;

  // group
  defaultLen: number;

  // number, string
  placeholder?: string;

  // number
  min?: number;
  max?: number;
  step?: number;


  // bool, select, radio-button
  optionStr?: string;

  // color
  showAlpha?: boolean;

  // date, date-range
  showTime?: boolean;

  nameErr?: string;
  defaultLenErr?: string;
  minErr?: string;
  maxErr?: string;
  stepErr?: string;
  optionErr?: string;

}


export class AddMorePropertyMenu extends React.PureComponent<Props, State> {
  state: State = {
    name: '',
    type: 'string',

    // group
    defaultLen: 2,

    // number, string
    placeholder: '',

    // bool, select, tags
    optionStr: '',

    showAlpha: false,
    showTime: false,
  };

  onName = (change: ChangeEvent<HTMLInputElement>) => {
    this.setState({name: change.target.value});
  };
  onType = (value: MoreValueType) => {
    this.setState({type: value});
  };

  onDefaultLen = (value: number) => {
    this.setState({defaultLen: value});
  };
  onMin = (value: number) => {
    this.setState({min: value});
  };
  onMax = (value: number) => {
    this.setState({max: value});
  };
  onStep = (value: number) => {
    this.setState({step: value});
  };

  onPlaceHolder = (change: ChangeEvent<HTMLInputElement>) => {
    this.setState({placeholder: change.target.value});
  };

  onOptionStr = (change: ChangeEvent<HTMLInputElement>) => {
    this.setState({optionStr: change.target.value});
  };

  onShowAlpha = (value: boolean) => {
    this.setState({showAlpha: value});
  };
  onShowTime = (value: boolean) => {
    this.setState({showTime: value});
  };

  onSubmit = (e: React.FormEvent<HTMLElement>) => {
    let {onAddProperty, group} = this.props;
    let {name, type, defaultLen, placeholder, min, max, step, optionStr, showAlpha, showTime} = this.state;
    e.preventDefault();

    let result: PropDesc | PropGroupDesc;

    let errors: any = {
      nameErr: null,
      defaultLenErr: null,
      minErr: null,
      maxErr: null,
      stepErr: null,
      optionErr: null
    };
    let hasError = false;

    function addError(name: string, value: string) {
      errors[name] = value;
      hasError = true;
    }

    if (typeof name !== 'string' || (
      name === '' &&
      type !== 'group' // allow group to use empty name (default group)
      && group !== '' // allow default group to have child with empty name
    )) {
      addError('nameErr', 'Invalid Name');
    } else if (group != null && name.match(endsWithNumberReg)) {
      addError('nameErr', "Number character not allowed");
    }
    if (type === 'group') {
      if (defaultLen == null || !(defaultLen >= 0)) {
        addError('defaultLenErr', 'Error');
      }
      result = {name, type: 'group', defaultLen};
    } else {
      result = {name, type};
      switch (type) {
        case 'number': {
          if (min != null) {
            if (typeof min !== 'number' || min !== min) {
              addError('minErr', 'Error');
            } else {
              result.min = min;
            }
          }
          if (max != null) {
            if (typeof max !== 'number' || max !== max) {
              addError('maxErr', 'Error');
            } else if (result.hasOwnProperty('min') && result.min >= max) {
              addError('minErr', 'Error');
              addError('maxErr', 'Error');
            } else {
              result.max = max;
            }
          }
          if (step != null) {
            if (typeof step !== 'number' || step !== step) {
              addError('stepErr', 'Error');
            } else {
              result.step = min;
            }
          }
          if (placeholder) {
            result.placeholder = placeholder;
          }
          break;
        }
        case 'string': {
          if (placeholder) {
            result.placeholder = placeholder;
          }
          break;
        }
        case 'select':
        case 'radio-button': {
          let options: string[] = optionStr.split(',');
          if (options.length < 2) {
            addError('optionErr', 'Require more than one option');
          } else {
            result.options = options;
          }
          break;
        }
        case 'toggle': {
          if (optionStr) {
            let options: string[] = optionStr.split(',');
            if (options.length !== 2) {
              addError('optionErr', 'Must have 0 or 2 options');
            } else {
              result.options = options;
            }
          }
          break;
        }
        case 'date':
        case 'date-range': {
          result.showTime = showTime;
          break;
        }
        case "color": {
          result.disableAlpha = !showAlpha;
          break;
        }
      }
    }

    if (!hasError) {
      onAddProperty(result);
      errors.name = ''; // reset name after adding property
    }
    this.setState(errors);
  };

  render() {
    let {group, onClick} = this.props;
    let {
      name, type, defaultLen, placeholder, min, max, step, optionStr, showAlpha, showTime,
      nameErr, defaultLenErr, minErr, maxErr, stepErr, optionErr
    } = this.state;
    return (
      <Form onClick={onClick} className='ticl-add-more-prop' labelCol={{span: 9}} wrapperCol={{span: 15}}
            onSubmit={this.onSubmit}>
        <FormItem label='Name' validateStatus={nameErr ? 'error' : null} help={nameErr}>
          <Input size='small' value={name} onChange={this.onName}/>
        </FormItem>
        <FormItem label='Type'>
          <Select size='small' value={type} onChange={this.onType}>
            <Option value='number'>number</Option>
            <Option value='string'>string</Option>
            <Option value='toggle'>toggle</Option>
            <Option value='select'>select</Option>
            <Option value='radio-button'>radio-button</Option>
            <Option value='color'>color</Option>
            <Option value='date'>date</Option>
            <Option value='date-range'>date-range</Option>
            <Option value='password'>password</Option>
            {
              group == null
                ? <Option value='group'>group</Option>
                : null // dont add group if it's in already a group
            }
          </Select>
        </FormItem>
        {
          type === 'group'
            ? (
              <FormItem label='Default Length' validateStatus={defaultLenErr ? 'error' : null}>
                <InputNumber size='small' min={0} step={1} value={defaultLen} onChange={this.onDefaultLen}/>
              </FormItem>
            )
            : null
        }
        {
          type === 'number'
            ? [(
              <FormItem label='Min Value' key='minbox' validateStatus={minErr ? 'error' : null}>
                <InputNumber size='small' value={min} onChange={this.onMin}/>
              </FormItem>
            ), (
              <FormItem label='Max Value' key='maxbox' validateStatus={maxErr ? 'error' : null}>
                <InputNumber size='small' value={max} onChange={this.onMax}/>
              </FormItem>
            ), (
              <FormItem label='Step' key='stepbox' validateStatus={stepErr ? 'error' : null}>
                <InputNumber size='small' value={step} onChange={this.onStep} min={0}/>
              </FormItem>
            )]
            : null
        }
        {
          type === 'toggle' || type === 'select' || type === 'radio-button'
            ? (
              <FormItem label='Options' validateStatus={optionErr ? 'error' : null} help={optionErr}>
                <Input size='small' placeholder='comma separated' value={optionStr} onChange={this.onOptionStr}/>
              </FormItem>
            )
            : null
        }
        {
          type === 'color'
            ? (
              <FormItem label='Show Alpha'>
                <Switch size='small' checked={showAlpha} onChange={this.onShowAlpha}/>
              </FormItem>
            )
            : null
        }
        {
          type === 'date' || type === 'date-range'
            ? (
              <FormItem label='Show Time'>
                <Switch size='small' checked={showTime} onChange={this.onShowTime}/>
              </FormItem>
            )
            : null
        }
        {
          type === 'string' || type === 'number'
            ? (
              <FormItem label='Place Holder'>
                <Input value={placeholder} size='small' onChange={this.onPlaceHolder}/>
              </FormItem>
            )
            : null
        }
        <Form.Item wrapperCol={{span: 15, offset: 9}}>
          <Button type="primary" htmlType="submit">
            Add Property
          </Button>
        </Form.Item>
      </Form>

    );
  }
}
