import {Block, DataMap, FunctionDesc, Functions, PropDesc} from '@ticlo/core';
import {useTicloComp} from '../hooks/useTicloComp.js';
import {Values} from '../types/Values.js';
import {useBlockConfigs} from '../hooks/useBlockConfigs.js';
import React from 'react';
import {registerComponent, renderChildren} from '../types/Component.js';
import {elementClassProperty, elementConfigs, elementStyleProperty} from '../types/CommontProps.js';

const optional: {[key: string]: PropDesc} = {
  output: {name: 'output', type: 'any', types: ['number', 'string'], readonly: true, pinned: true},
  accept: {name: 'accept', type: 'string'},
  alt: {name: 'alt', type: 'string'},
  autoComplete: {name: 'autoComplete', type: 'string'},
  autoFocus: {name: 'autoFocus', type: 'toggle'},
  capture: {name: 'capture', type: 'any', types: ['toggle', 'string']}, // https://www.w3.org/TR/html-media-capture/#the-capture-attribute
  checked: {name: 'checked', type: 'toggle'},
  crossOrigin: {name: 'crossOrigin', type: 'string'},
  disabled: {name: 'disabled', type: 'toggle'},
  form: {name: 'form', type: 'string'},
  formAction: {name: 'formAction', type: 'string'},
  formEncType: {name: 'formEncType', type: 'string'},
  formMethod: {name: 'formMethod', type: 'string'},
  formNoValidate: {name: 'formNoValidate', type: 'toggle'},
  formTarget: {name: 'formTarget', type: 'string'},
  height: {name: 'height', type: 'any', types: ['number', 'string']},
  list: {name: 'list', type: 'string'},
  max: {name: 'max', type: 'any', types: ['number', 'string']},
  maxLength: {name: 'maxLength', type: 'number'},
  min: {name: 'min', type: 'any', types: ['number', 'string']},
  minLength: {name: 'minLength', type: 'number'},
  multiple: {name: 'multiple', type: 'toggle'},
  name: {name: 'name', type: 'string'},
  pattern: {name: 'pattern', type: 'string'},
  placeholder: {name: 'placeholder', type: 'string'},
  readOnly: {name: 'readOnly', type: 'toggle'},
  required: {name: 'required', type: 'toggle'},
  size: {name: 'size', type: 'number'},
  src: {name: 'src', type: 'string'},
  step: {name: 'step', type: 'any', types: ['number', 'string']},
  width: {name: 'width', type: 'any', types: ['number', 'string']},
};

const inputOptions = {
  noChildren: true,
  optionalHandler(block: Block, name: string) {
    if (name === 'output') {
      return (event: React.ChangeEvent<HTMLInputElement>) => {
        block.updateValue('output', event.target.value);
      };
    }
  },
};

const inputElementDesc: FunctionDesc = {
  name: 'input',
  base: 'react:element',
  properties: [
    {
      name: 'value',
      type: 'any',
      types: ['string', 'number'],
    },
    {
      name: 'defaultValue',
      type: 'any',
      types: ['string', 'number'],
    },
    {
      name: 'type',
      type: 'select',
      options: [
        'text',
        'number',
        'password',
        'email',
        'tel',
        'url',
        'date',
        'datetime-local',
        'month',
        'time',
        'week',
        'file',
        'checkbox',
        'radio',
        'range',
        'color',
        'search',
        'submit',
        'reset',
        'button',
      ],
    },
    elementClassProperty,
    elementStyleProperty,
  ],
  optional,
  category: 'react:elements',
};
const inputPropMap = {
  value: {value: Values.strOrNum},
  checked: {value: Values.boolean},
  defaultValue: {value: Values.strOrNum},
  defaultChecked: {value: Values.boolean},
  type: {value: Values.string},
};
function InputElement({block}: {block: Block}) {
  const {style, className, optionalHandlers} = useTicloComp(block, inputOptions);
  const {value, checked, defaultValue, defaultChecked, type} = useBlockConfigs(block, inputPropMap);
  return (
    <input
      value={value}
      checked={checked}
      defaultValue={defaultValue}
      defaultChecked={defaultChecked}
      type={type}
      style={style}
      className={className}
      {...optionalHandlers}
    />
  );
}
registerComponent(InputElement, 'input', null, inputElementDesc, 'react');

const textareaOptional: {[key: string]: PropDesc} = {
  output: {name: 'output', type: 'any', types: ['string'], readonly: true, pinned: true},
  autoComplete: {name: 'autoComplete', type: 'string'},
  autoFocus: {name: 'autoFocus', type: 'toggle'},
  cols: {name: 'cols', type: 'number'},
  disabled: {name: 'disabled', type: 'toggle'},
  form: {name: 'form', type: 'string'},
  maxLength: {name: 'maxLength', type: 'number'},
  minLength: {name: 'minLength', type: 'number'},
  name: {name: 'name', type: 'string'},
  placeholder: {name: 'placeholder', type: 'string'},
  readOnly: {name: 'readOnly', type: 'toggle'},
  required: {name: 'required', type: 'toggle'},
  rows: {name: 'rows', type: 'number'},
  wrap: {name: 'wrap', type: 'select', options: ['soft', 'hard']},
};

const textareaOptions = {
  optionalHandler(block: Block, name: string) {
    if (name === 'output') {
      return (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        block.updateValue('output', event.target.value);
      };
    }
  },
};

const textareaPropMap = {
  value: {value: Values.string},
  defaultValue: {value: Values.string},
};

const textareaElementDesc: FunctionDesc = {
  name: 'textarea',
  base: 'react:element',
  properties: [
    {name: 'value', type: 'string'},
    {name: 'defaultValue', type: 'string'},
    elementClassProperty,
    elementStyleProperty,
  ],
  optional: textareaOptional,
  category: 'react:elements',
};

function TextareaElement({block}: {block: Block}) {
  const {style, className, children, optionalHandlers} = useTicloComp(block, textareaOptions);
  const {value, defaultValue} = useBlockConfigs(block, textareaPropMap);
  return (
    <textarea value={value} defaultValue={defaultValue} style={style} className={className} {...optionalHandlers}>
      {renderChildren(children)}
    </textarea>
  );
}
registerComponent(TextareaElement, 'textarea', null, textareaElementDesc, 'react');

const selectOptional: {[key: string]: PropDesc} = {
  output: {name: 'output', type: 'any', types: ['string', 'number', 'array'], readonly: true, pinned: true},
  autoComplete: {name: 'autoComplete', type: 'string'},
  autoFocus: {name: 'autoFocus', type: 'toggle'},
  disabled: {name: 'disabled', type: 'toggle'},
  form: {name: 'form', type: 'string'},
  multiple: {name: 'multiple', type: 'toggle'},
  name: {name: 'name', type: 'string'},
  required: {name: 'required', type: 'toggle'},
  size: {name: 'size', type: 'number'},
};

const selectOptions = {
  optionalHandler(block: Block, name: string) {
    if (name === 'output') {
      return (event: React.ChangeEvent<HTMLSelectElement>) => {
        if (event.target.multiple) {
          const val = Array.from(event.target.selectedOptions, (option) => option.value);
          block.updateValue('output', val);
        } else {
          block.updateValue('output', event.target.value);
        }
      };
    }
  },
};

const selectPropMap = {
  value: {value: Values.any},
  defaultValue: {value: Values.any},
  multiple: {value: Values.boolean},
};

const selectElementDesc: FunctionDesc = {
  name: 'select',
  base: 'react:element',
  properties: [
    {name: 'value', type: 'any'},
    {name: 'defaultValue', type: 'any'},
    elementClassProperty,
    elementStyleProperty,
  ],
  optional: selectOptional,
  category: 'react:elements',
};

function SelectElement({block}: {block: Block}) {
  const {style, className, children, optionalHandlers} = useTicloComp(block, selectOptions);
  const {value, defaultValue, multiple} = useBlockConfigs(block, selectPropMap);
  return (
    <select
      value={value}
      defaultValue={defaultValue}
      multiple={multiple}
      style={style}
      className={className}
      {...optionalHandlers}
    >
      {renderChildren(children)}
    </select>
  );
}
registerComponent(SelectElement, 'select', null, selectElementDesc, 'react');
