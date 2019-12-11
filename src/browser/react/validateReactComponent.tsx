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
  } else if (component && typeof component === 'object') {
    if (Array.isArray(component)) {
      let result: any[] = [];
      for (let child of component) {
        let validatedChild = validateSingleComponent(child);
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
