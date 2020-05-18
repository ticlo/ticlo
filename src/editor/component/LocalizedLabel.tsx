import React, {useContext} from 'react';
import {FunctionDesc, translateEditor, translateFunction} from '../../../src/core/editor';
import {TicloLayoutContextType} from './LayoutContext';

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

export const LocalizedPropertyName = () => {
  useContext(TicloLayoutContextType);
};
