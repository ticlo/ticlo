import React from 'react';

const reactTypeof = ((<div />) as any).$$typeof;

function validateSingleComponent(component: any) {
  if (component && typeof component === 'object' && component.$$typeof !== reactTypeof) {
    return null;
  }
  return component;
}

export function validateReactComponent(component: any) {
  if (component == null) {
    return '';
  } else if (typeof component === 'object') {
    if (Array.isArray(component)) {
      const result: any[] = [];
      for (const child of component) {
        const validatedChild = validateSingleComponent(child);
        if (validatedChild != null) {
          result.push(validatedChild);
        }
      }
      return result;
    }
    if (component.$$typeof !== reactTypeof) {
      return '';
    }
  }
  return component;
}
