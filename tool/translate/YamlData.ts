// this is not a generic yaml parser, it only supports object structure and string types
import YAML from 'yaml';
import fs from 'fs';
import crypto from 'crypto';

const rowreg = /^( *)(([^:'"]+)|('[^']+')|("[^"]+")):(.*?)(#[^'"]+)?$/;

function parseYamlString(str: string) {
  if (str.startsWith('"') || str.startsWith("'")) {
    return YAML.parse(str);
  }
  return str;
}

function hashValue(str: string | Buffer): string {
  const hash = crypto.createHash('md5');
  hash.update(str);
  return hash.digest().toString('base64').substring(0, 8);
}

function writeYamlString(str: string, comment: string, indent: number) {
  if (str.includes('\n')) {
    let firstRow = '|-';
    if (comment) {
      firstRow = `|- ${comment}`;
    }
    let indentStr = ''.padStart(indent + 2);
    let results = [firstRow];
    for (let line of str.split('\n')) {
      results.push(`${indentStr}${line}`);
    }
    return results.join('\n');
  } else {
    let result = '';
    if (str !== '') {
      result = YAML.stringify(str).trim();
    }
    if (comment) {
      return `${result} ${comment}`;
    }
    return result;
  }
}

export class YamlData {
  rows: YamlRow[] = [];
  mapping = new Map<string, YamlRow>();

  constructor(data: string) {
    let rawrows = data.split('\n');
    let current: YamlRow;
    for (let row of rawrows) {
      let yamlRow = new YamlRow(row.trimRight(), current);

      if (yamlRow.key) {
        current = yamlRow;
        if (yamlRow.value || yamlRow.multiLineIndent) {
          this.mapping.set(yamlRow.key, yamlRow);
        }
      }
      if (!yamlRow.merged) {
        this.rows.push(yamlRow);
      }
    }
  }

  calculateValueHash() {
    for (let [key, row] of this.mapping) {
      if (row.value) {
        row.valueHash = hashValue(row.value);
      }
    }
  }
}

class YamlRow {
  static genertedFromHash = 'auto translated from hash: ';
  static genertedFromHashLen = YamlRow.genertedFromHash.length;

  parent: YamlRow;
  indent: number;
  rawkey: string;
  key: string;
  value: string;
  comment: string;
  valueHash: string;

  // when the value uses multi-line format
  multiLineIndent: string;

  // true when this is a line that's already merged into a previous multi-line value
  merged = false;

  constructor(public raw: string, previous: YamlRow) {
    let match = raw.match(rowreg);
    if (match) {
      this.indent = match[1].length;
      while (previous && previous.indent >= this.indent) {
        previous = previous.parent;
      }
      this.rawkey = match[2].trimRight();
      this.key = parseYamlString(this.rawkey);
      if (previous) {
        this.key = `${previous.key}.${this.key}`;
        this.parent = previous;
      }

      this.value = match[6].trim();
      if (this.value === '|-') {
        // handle multi-line
        this.value = '';
        this.multiLineIndent = match[1] + '  ';
      } else {
        this.value = parseYamlString(this.value);
      }

      this.comment = match[7]?.trim();
    } else if (previous?.multiLineIndent) {
      // handle multi-line
      if (raw.startsWith(previous.multiLineIndent)) {
        let currentLine = raw.substring(previous.multiLineIndent.length);
        if (previous.value) {
          previous.value = `${previous.value}\n${currentLine}`;
        } else {
          previous.value = currentLine;
        }
        // not push this to rows
        this.merged = true;
      }
    }
  }
}

class OutputRow {
  translated: string;
  comment: string;

  constructor(public enRow: YamlRow) {
    if (enRow.comment?.includes('no translate')) {
      this.translated = enRow.value;
      this.comment = enRow.comment;
    } else if (enRow.rawkey === "'@keywords'") {
      this.translated = '';
    }
  }
}

export class OutputYamlData {
  // output rows
  rows: OutputRow[] = [];

  // rows exist in previous output, but not exist in new enSource
  unused: YamlRow[] = [];

  mapping = new Map<string, OutputRow>();
  toBeTranslated = new Map<string, OutputRow>();

  constructor(public enSource: YamlData, public yamlPath: string) {
    for (let row of enSource.rows) {
      let outrow = new OutputRow(row);
      this.rows.push(outrow);
      if (row.key && enSource.mapping.has(row.key)) {
        this.mapping.set(row.key, outrow);
      }
    }
  }

  mergeExistingData() {
    if (fs.existsSync(this.yamlPath)) {
      let str = fs.readFileSync(this.yamlPath, {encoding: 'utf8'});
      let oldData = new YamlData(str);

      for (let [key, oldRow] of oldData.mapping) {
        if (this.mapping.has(key)) {
          let outrow = this.mapping.get(key);
          let generatedPos = oldRow.comment?.indexOf(YamlRow.genertedFromHash);
          if (generatedPos > 0) {
            let hash = oldRow.comment.substring(
              generatedPos + YamlRow.genertedFromHashLen,
              generatedPos + YamlRow.genertedFromHashLen + 8
            );
            if (hash !== outrow.enRow.valueHash) {
              continue;
            }
          }
          outrow.translated = oldRow.value;
          outrow.comment = oldRow.comment;
        } else {
          if (!key.includes('.') && oldRow.value && !oldRow.comment?.includes(YamlRow.genertedFromHash)) {
            // top level manual translation need to be kept
            this.unused.push(oldRow);
          }
        }
      }
    }
  }

  prepareTranslate() {
    for (let [key, outRow] of this.mapping) {
      if (outRow.translated == null) {
        this.toBeTranslated.set(key, outRow);
      }
    }
  }

  applyTranslate(map: Map<string, string>) {
    for (let [key, row] of this.toBeTranslated) {
      row.translated = map.get(row.enRow.value);
      let generatedStr = `${YamlRow.genertedFromHash}${row.enRow.valueHash}`;
      row.comment = row.comment ? `${row.comment} ${generatedStr}` : `# ${generatedStr}`;
    }
    this.writeToYaml();
  }
  writeToYaml() {
    console.log(`writing to ${this.yamlPath}`);
    let output: string[] = [];
    if (this.unused.length) {
      output.push('# no longer used');
      for (let row of this.unused) {
        output.push(row.raw);
      }
      output.push('\n');
    }
    for (let row of this.rows) {
      let {rawkey, indent, raw, value} = row.enRow;
      if (value) {
        output.push(`${''.padStart(indent)}${rawkey}: ${writeYamlString(row.translated, row.comment, indent)}`);
      } else {
        output.push(raw);
      }
    }
    let outputStr = output.join('\n');
    fs.writeFileSync(this.yamlPath, outputStr);
  }
}
