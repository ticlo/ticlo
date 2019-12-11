import React from 'react';

const reactTypeof = ((<div />) as any).$$typeof;

export function validateReactComponent(component: any) {
  if (typeof component === 'object' && !(Object.isExtensible(component) || component.$$typeof !== reactTypeof)) {
    component = null;
  }
  if (component == null) {
    return "";
  }
  return component;
}
