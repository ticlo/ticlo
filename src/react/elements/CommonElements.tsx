import React from 'react';
import {Functions} from '../../core/block/Functions';
import {FunctionDesc, PropDesc, PropGroupDesc} from '../../core/block/Descriptor';
import {elementChildrenProperty, elementConfigs, elementOutputProperty, HtmlElementFunction} from '../BaseElement';

const divElementDesc: FunctionDesc = {
  name: 'div',
  base: 'react:element',
  configs: elementConfigs,
  properties: [elementChildrenProperty, elementOutputProperty],
  category: 'react:elements'
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

//
// class AElementFunction extends DivElementFunction {
//   getComponent(): any {
//     return 'a';
//   }
//
//   getProps(): {[p: string]: any} {
//     return {...super.getProps(), href: this._data.getValue('href'), target: this._data.getValue('target')};
//   }
// }
// Functions.add(
//   AElementFunction,
//   {
//     name: 'a',
//     icon: 'fab:react',
//     properties: [
//       childrenPropertyGroup,
//       {
//         name: 'href',
//         type: 'string',
//         visible: 'high'
//       },
//       {
//         name: 'target',
//         type: 'combo-box',
//         options: ['_blank', '_self', '_parent', '_top'],
//         visible: 'low'
//       },
//       ...commonProperties
//     ]
//   },
//   'react'
// );
