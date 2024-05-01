/**
 * This script generates the /src/html/functions/StyleDef.ts
 * Which creates css property definitions used by the CreateStyle function
 */
import fs from 'fs';
import {FunctionDesc, PropDesc, ValueType} from '../src/core';

abstract class Parser {
  init(line: string): Parser {
    return this.parseLine(line);
  }
  abstract parseLine(line: string): Parser;
}

let keys = new Map<string, string[]>();
let types = new Map<string, string[]>();

class InterfaceParser extends Parser {
  init(line: string): Parser {
    for (let cls of [
      'interface StandardLonghandProperties<',
      'interface StandardShorthandProperties<',
      'interface SvgProperties<',
    ]) {
      if (line.includes(cls)) {
        return this;
      }
    }
    return new IgnoreInterfaceParser().init(line);
  }
  parseLine(line: string): Parser {
    if (line.endsWith('}')) {
      return null;
    }
    if (commentReg.test(line)) {
      return new CommentParser(this);
    }
    if (line.includes('?: ') && line.endsWith(';')) {
      let [key, types] = line
        .substring(0, line.length - 1)
        .trim()
        .split('?: ');
      let values: string[] = [];
      for (let type of types.split('|')) {
        values.push(type.trim());
      }
      keys.set(key, values);
    } else if (line !== '') {
      console.log('unknown1:');
      console.log(line);
    }
    return this;
  }
}
class IgnoreInterfaceParser extends Parser {
  parseLine(line: string): Parser {
    if (line.endsWith('}')) {
      return null;
    }
    return this;
  }
}
class TypeParser extends Parser {
  init(line: string): Parser {
    if (line.endsWith(';')) {
      let [before, after] = line.substring(0, line.length - 1).split(' = ');
      let key = before.split(' ').pop();
      let values = after.split(' | ');
      types.set(key, values);
    } else if (line.endsWith('=')) {
      return new MultiLineTypeParser().init(line);
    } else {
      console.log('unknown2:');
      console.log(line);
    }
    return null;
  }
  parseLine(line: string): Parser {
    return null;
  }
}
class MultiLineTypeParser extends Parser {
  key: string;
  init(line: string): Parser {
    this.key = line
      .substring(0, line.length - 2)
      .split(' ')
      .pop();
    return this;
  }
  values: string[] = [];
  addType(line: string) {
    this.values.push(line.split('|').pop().trim());
  }
  parseLine(line: string): Parser {
    if (line.endsWith(';')) {
      this.addType(line.substring(0, line.length - 1));
      types.set(this.key, this.values);
      return null;
    } else {
      this.addType(line);
      return this;
    }
  }
}

const commentReg = /^ +\/\*\*/;
class CommentParser extends Parser {
  constructor(public parent: Parser) {
    super();
  }
  parseLine(line: string): Parser {
    if (line.endsWith('*/')) {
      return this.parent;
    }
    return this;
  }
}

let data = fs.readFileSync('./node_modules/csstype/index.d.ts', 'utf8');
let lines = data.split('\n');

let current: Parser;
for (let line of lines) {
  if (current) {
    current = current.parseLine(line);
  } else if (line.startsWith('export interface ')) {
    current = new InterfaceParser().init(line);
  } else if (line.startsWith('type ') || line.startsWith('export type ')) {
    current = new TypeParser().init(line);
  } else if (line !== '') {
    console.log('unknown0:');
    console.log(line);
  }
}

let resolved = new Set<string>(['string', 'number', 'Globals', 'TLength', 'Color']);
types.set('TLength', null);
types.set('Globals', null);
types.set('string', null);
types.set('number', null);
types.set('Color', null);

function mapValues(values: string[]) {
  if (!values) {
    debugger;
  }
  for (let i = values.length - 1; i >= 0; --i) {
    let value = values[i];
    if (!value.startsWith('"')) {
      let mapValues = resolveType(value);
      if (mapValues) {
        values.splice(i, 1, ...mapValues);
      }
    } else if (value.startsWith('"-')) {
      values.splice(i, 1);
    }
  }
  return values;
}
function resolveType(type: string): string[] {
  if (!resolved.has(type)) {
    resolved.add(type);
    let values = types.get(type);
    if (type.toLowerCase().includes('deprecate')) {
      values.length = 0;
    } else {
      mapValues(values);
    }
    return values;
  }
  return types.get(type);
}

let def: {[key: string]: PropDesc} = {};
for (let [key, values] of keys) {
  let prop: PropDesc = {name: key, type: 'any'};

  let dynamicTypes: ValueType[] = [];
  values = [...new Set(mapValues(values))]; // get unique values
  let fixFirstType = false;
  let lowerKey = key.toLowerCase();
  if (values.includes('Color')) {
    dynamicTypes.push('color');
    if (lowerKey.endsWith('color')) {
      fixFirstType = true;
    }
  }
  if (values.includes('number') || values.includes('TLength')) {
    if (
      lowerKey.endsWith('width') ||
      lowerKey.endsWith('height') ||
      lowerKey.endsWith('size') ||
      lowerKey.endsWith('thickness') ||
      lowerKey.endsWith('offset')
    ) {
      dynamicTypes.unshift('number');
      fixFirstType = true;
    } else {
      dynamicTypes.push('number');
    }
  }
  let options: string[] = values.filter((s) => s.startsWith('"'));
  if (options.length > 1) {
    if (!fixFirstType && options.length > 3) {
      dynamicTypes.unshift('select');
    } else {
      dynamicTypes.push('select');
    }

    prop.options = options.map((s) => s.substring(1, s.length - 1));
  }

  if (dynamicTypes.length) {
    if (
      !fixFirstType &&
      values.includes('string') &&
      (dynamicTypes.length === 3 || !(dynamicTypes[0] === 'select' && options.length > 5))
    ) {
      dynamicTypes.unshift('string');
    } else {
      dynamicTypes.push('string');
    }

    prop.types = dynamicTypes;
  } else {
    prop.type = 'string';
  }

  def[key] = prop;
}

fs.writeFile(
  './src/html/functions/StyleDef.ts',
  `// generated by build-style-def.ts
import {PropDesc} from '../../../src/core';
export default ${JSON.stringify(def, null, 2)} as {[key: string]: PropDesc};`,
  () => {}
);
