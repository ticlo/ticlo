import {globalFunctions} from '../block/FunctionLib.ts';

globalFunctions.addCategory({
  id: 'math',
  name: 'math',
  icon: '23:🞥',
  color: '4af',
});

globalFunctions.addCategory({
  id: 'string',
  name: 'string',
  icon: '14:str',
  color: '4af',
});

globalFunctions.addCategory({
  id: 'script',
  name: 'script',
  icon: '^:{ }',
  color: '1bb',
});

globalFunctions.addCategory({
  id: 'compare',
  name: 'compare',
  icon: '23:=',
  color: '4af',
});

globalFunctions.addCategory({
  id: 'condition',
  name: 'condition',
  icon: '^:if',
  color: '4af',
});

globalFunctions.addCategory({
  id: 'web-server',
  name: 'web-server',
  icon: 'svg:network-wired',
  color: '4af',
  ns: 'web-server',
});

globalFunctions.addCategory({
  id: 'http',
  name: 'http',
  icon: ':://',
  color: '4af',
  ns: 'http',
});

globalFunctions.addCategory({
  id: 'other',
  name: 'other',
  icon: '22:?',
  color: '4af',
});

globalFunctions.addCategory({
  id: 'repeat',
  name: 'repeat',
  icon: 'svg:grip-vertical',
  color: '1bb',
  // color: 'e91',
});

globalFunctions.addCategory({
  id: 'data',
  name: 'data',
  icon: 'svg:code-branch',
  color: '4af',
});

globalFunctions.addCategory({
  id: 'date',
  name: 'date',
  icon: 'svg:clock',
  color: '4af',
});

globalFunctions.addCategory({
  id: 'time',
  name: 'time',
  icon: 'svg:stopwatch',
  color: '4af',
});
