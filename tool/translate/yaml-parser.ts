// this is not a generic yaml parser, it only supports object structure and string types
export class YamlData {
  constructor(data: string) {
    let rows = data.split('\n');
    if (rows.length < 0 || rows[0] !== '---') {
      throw new Error('invalid yaml');
    }
  }
}

class YamlRow {
  key: string;
  value: string;
  comment: string;
}
