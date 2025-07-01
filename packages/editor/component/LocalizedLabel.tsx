import React, {MouseEventHandler, useContext} from 'react';
import {
  DataMap,
  FunctionDesc,
  TicloI18nSettings,
  translateEditor,
  translatePropContent,
  translateFunction,
  translateProperty,
} from '@ticlo/core/editor';
import {TicloLayoutContextType} from './LayoutContext';

export const LocalizedLabel = ({label, options}: {label: string; options?: DataMap}) => {
  useContext(TicloLayoutContextType);
  return <span>{translateEditor(label, options)}</span>;
};

// quick access for LocalizedLabel
export function t(label: string, options?: DataMap) {
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
  onContextMenu,
}: {
  desc: FunctionDesc;
  name: string;
  className?: string;
  onContextMenu?: MouseEventHandler<HTMLSpanElement>;
}) => {
  useContext(TicloLayoutContextType);
  return (
    <span className={className} onContextMenu={onContextMenu}>
      {translateProperty(desc.name, name, desc.ns)}
    </span>
  );
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
  return <span>{translatePropContent(desc.name, propName, String(option), desc.ns)}</span>;
};

export const LocalizedFuncCommand = ({desc, command}: {desc: FunctionDesc; command: string}) => {
  useContext(TicloLayoutContextType);
  return <span>{translateFunction(desc.id, `${desc.name}.@commands.${command}`, desc.ns)}</span>;
};

export const LocalizedPropCommand = ({
  funcDesc,
  propBaseName,
  command,
}: {
  funcDesc: FunctionDesc;
  propBaseName: string;
  command: string;
}) => {
  useContext(TicloLayoutContextType);
  return <span>{translateProperty(`${funcDesc.name}.${propBaseName}.@commands`, command, funcDesc.ns)}</span>;
};

const specialNodeNamePrefix = /^#\w+\b/;
const specialNodeNamePostfix = /-\w+-#$/;

export const LocalizedNodeName = ({name, options}: {name: string; options?: any}) => {
  useContext(TicloLayoutContextType);
  function localizeNodeName(match: string) {
    return translateEditor(match, options);
  }
  name = name.replace(specialNodeNamePrefix, localizeNodeName).replace(specialNodeNamePostfix, localizeNodeName);
  return <span>{name}</span>;
};
