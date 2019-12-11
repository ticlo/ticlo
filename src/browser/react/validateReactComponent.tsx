import React from 'react';

const reactTypeof = ((<div />) as any).$$typeof;

export function validateReactComponent(component: any) {
  if (component && typeof component === 'object' && component.$$typeof !== reactTypeof) {
    component = null;
  }
  if (component == null) {
    return "";
  }
  return component;
}
