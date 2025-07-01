import YAML from 'yaml';
import * as glob from 'glob';
import fs from 'fs';

const treg = /\b(?:t|translateEditor)\(['"](.*?)['"](\)|, \{)/g;

const enyaml = './packages/editor/i18n/en.yaml';
const substrLen = 'packages/editor/'.length;
const commonPath = 'packages/editor/util/i18n-common.ts';

let sharedKeys = new Map<string, string>();
let allFiles = new Map<string, string[]>();

function main() {
  const existingEn = fs.readFileSync(enyaml, {encoding: 'utf-8'});
  const enMap: Record<string, string> = YAML.parse(existingEn);
  let files: string[] = glob.sync(`./packages/editor/**/*.{ts,tsx}`, {posix: true});
  files.unshift(commonPath);
  for (let path of files) {
    let data = fs.readFileSync(path, 'utf8');
    let comment = path.substring(substrLen);
    let keys: string[] = [];
    for (let match of data.matchAll(treg)) {
      let key = match[1];
      if (sharedKeys.has(key)) {
        let previousComment = sharedKeys.get(key);
        if (!previousComment.includes(comment)) {
          sharedKeys.set(key, `${previousComment} & ${comment}`);
        }
      } else {
        sharedKeys.set(key, comment);
        keys.push(key);
      }
    }
    if (keys.length) {
      allFiles.set(comment, keys);
    }
  }

  let common: string[] = [];
  let multipleOccur: string[] = [];
  for (let [key, comment] of sharedKeys) {
    if (comment.includes('util/i18n-common.ts')) {
      common.push(`"${key}": "${enMap[key] ?? key}"`);
    } else if (comment.includes(' & ')) {
      multipleOccur.push(
        `# ${comment
          .split(' & ')
          .map((str: string) => str.split('/').pop())
          .join(' & ')}\n"${key}": "${enMap[key] ?? key}"`
      );
    } else {
      // remove it from shared keys
      sharedKeys.delete(key);
    }
  }
  let out: string[] = ['# Common'].concat(common).concat(['']).concat(multipleOccur);
  for (let [comment, keys] of allFiles) {
    let uniqueKeys = keys.filter((key: string) => !sharedKeys.has(key));
    if (uniqueKeys.length) {
      out.push(`\n# ${comment}`);
      for (let key of uniqueKeys) {
        out.push(`"${key}": "${enMap[key] ?? key}"`);
      }
    }
  }

  fs.writeFileSync(enyaml, out.join('\n'));
}

main();
