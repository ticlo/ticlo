import React, {useContext} from 'react';
import {
  FunctionDesc,
  TicloI18nSettings,
  translateEditor,
  translateEnumOption,
  translateFunction,
  translateProperty,
} from '../../../src/core/editor';
import {TicloLayoutContextType} from './LayoutContext';
import i18next from 'i18next';

export const LocalizedLabel = ({label, options}: {label: string; options?: any}) => {
  useContext(TicloLayoutContextType);
  return <span>{translateEditor(label, options)}</span>;
};

// quick access for LocalizedLabel
export function t(label: string, options?: any) {
  return <LocalizedLabel label={label} options={options} />;
}

export const LocalizedFunctionName = ({desc, className}: {desc: FunctionDesc; className?: string}) => {
  useContext(TicloLayoutContextType);
  return <span className={className}>{translateFunction(desc.id, desc.name, desc.ns)}</span>;
};

export const LocalizedPropertyName = ({
  desc,
  className,
  name,
}: {
  desc: FunctionDesc;
  name: string;
  className?: string;
}) => {
  useContext(TicloLayoutContextType);
  return <span className={className}>{translateProperty(desc.id, name, desc.ns)}</span>;
};

export const LocalizedEnumOption = ({
  desc,
  propName,
  option,
}: {
  desc: FunctionDesc;
  propName: string;
  option: string | number;
}) => {
  useContext(TicloLayoutContextType);
  return <span>{translateEnumOption(desc.id, propName, String(option), desc.ns)}</span>;
};

const specialNodeNamePrefix = /^#\w+\b/;
function localizeNodeNamePrefix(match: string) {
  return translateEditor(match);
}
export const LocalizedNodeName = ({name}: {name: string}) => {
  useContext(TicloLayoutContextType);
  if (TicloI18nSettings.shouldTranslateFunction) {
    name = name.replace(specialNodeNamePrefix, localizeNodeNamePrefix);
  }
  return <span>{name}</span>;
};
