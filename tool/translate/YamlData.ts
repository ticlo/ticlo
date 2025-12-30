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
    const indentStr = ''.padStart(indent + 2);
    const results = [firstRow];
    for (const line of str.split('\n')) {
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
    const rawrows = data.split('\n');
    let current: YamlRow;
    for (const row of rawrows) {
      const yamlRow = new YamlRow(row.trimRight(), current);

      if (yamlRow.key) {
        current = yamlRow;
        if (yamlRow.value != null || yamlRow.multiLineIndent) {
          this.mapping.set(yamlRow.key, yamlRow);
        }
      }
      if (!yamlRow.merged) {
        this.rows.push(yamlRow);
      }
    }
  }

  calculateValueHash() {
    for (const [key, row] of this.mapping) {
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

  constructor(
    public raw: string,
    previous: YamlRow
  ) {
    const match = raw.match(rowreg);
    if (match) {
      this.indent = match[1].length;
      while (previous && previous.indent >= this.indent) {
        previous = previous.parent;
      }
      this.rawkey = match[2].trimEnd();
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
        const currentLine = raw.substring(previous.multiLineIndent.length);
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

  constructor(
    public enSource: YamlData,
    public yamlPath: string
  ) {
    for (const row of enSource.rows) {
      const outrow = new OutputRow(row);
      this.rows.push(outrow);
      if (row.key && enSource.mapping.has(row.key)) {
        this.mapping.set(row.key, outrow);
      }
    }
  }

  mergeExistingData() {
    if (fs.existsSync(this.yamlPath)) {
      const str = fs.readFileSync(this.yamlPath, {encoding: 'utf8'});
      const oldData = new YamlData(str);

      for (const [key, oldRow] of oldData.mapping) {
        if (this.mapping.has(key)) {
          const outrow = this.mapping.get(key);
          const generatedPos = oldRow.comment?.indexOf(YamlRow.genertedFromHash);
          if (generatedPos > 0) {
            const hash = oldRow.comment.substring(
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
    for (const [key, outRow] of this.mapping) {
      if (outRow.translated == null) {
        this.toBeTranslated.set(key, outRow);
      }
    }
  }

  applyTranslate(map: Map<string, string>) {
    for (const [key, row] of this.toBeTranslated) {
      row.translated = map.get(row.enRow.value);
      if (row.enRow.valueHash) {
        const generatedStr = `${YamlRow.genertedFromHash}${row.enRow.valueHash}`;
        row.comment = row.comment ? `${row.comment} ${generatedStr}` : `# ${generatedStr}`;
      }
    }
    this.writeToYaml();
  }
  writeToYaml() {
    console.log(`writing to ${this.yamlPath}`);
    const output: string[] = [];
    if (this.unused.length) {
      output.push('# no longer used');
      for (const row of this.unused) {
        output.push(row.raw);
      }
      output.push('\n');
    }
    for (const row of this.rows) {
      const {rawkey, indent, raw, value} = row.enRow;
      if (value != null) {
        const rowValue = writeYamlString(row.translated, row.comment, indent);
        if (rowValue) {
          output.push(`${''.padStart(indent)}${rawkey}: ${rowValue}`);
          continue;
        }
      }
      output.push(raw);
    }
    const outputStr = output.join('\n');
    fs.writeFileSync(this.yamlPath, outputStr);
  }
}
