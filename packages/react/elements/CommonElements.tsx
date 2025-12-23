import React from 'react';
import {Functions} from '@ticlo/core/block/Functions.js';
import {FunctionDesc, PropDesc, PropGroupDesc} from '@ticlo/core/block/Descriptor.js';
import {
  elementChildrenProperty,
  elementClassProperty,
  elementConfigs,
  elementOutputProperty,
  elementStyleProperty,
  HtmlElementFunction,
} from '../BaseElement.js';

const divElementDesc: FunctionDesc = {
  name: 'div',
  base: 'react:element',
  configs: elementConfigs,
  properties: [elementChildrenProperty, elementClassProperty, elementStyleProperty, elementOutputProperty],
  category: 'react:elements',
};

class DivElementFunction extends HtmlElementFunction {
  getComponent(): any {
    return 'div';
  }
}

Functions.add(DivElementFunction, divElementDesc, 'react');

class SpanElementFunction extends HtmlElementFunction {
  getComponent(): any {
    return 'span';
  }
}
Functions.add(SpanElementFunction, {...divElementDesc, name: 'span'}, 'react');

class PElementFunction extends HtmlElementFunction {
  getComponent(): any {
    return 'p';
  }
}
Functions.add(PElementFunction, {...divElementDesc, name: 'p'}, 'react');

class PreElementFunction extends HtmlElementFunction {
  getComponent(): any {
    return 'pre';
  }
}
Functions.add(PreElementFunction, {...divElementDesc, name: 'pre'}, 'react');

class ButtonElementFunction extends HtmlElementFunction {
  getComponent(): any {
    return 'button';
  }
}
Functions.add(ButtonElementFunction, {...divElementDesc, name: 'button'}, 'react');
