import YAML from 'yaml';
import * as glob from 'glob';
import fs from 'fs';

const treg = /\b(?:t|translateEditor)\(['"](.*?)['"](\)|, \{)/g;

const enyaml = './packages/editor/i18n/en.yaml';
const substrLen = 'packages/editor/'.length;
const commonPath = 'packages/editor/util/i18n-common.ts';

const sharedKeys = new Map<string, string>();
const allFiles = new Map<string, string[]>();

function main() {
  const existingEn = fs.readFileSync(enyaml, {encoding: 'utf-8'});
  const enMap: Record<string, string> = YAML.parse(existingEn);
  const files: string[] = glob.sync(`./packages/editor/**/*.{ts,tsx}`, {posix: true});
  files.unshift(commonPath);
  for (const path of files) {
    const data = fs.readFileSync(path, 'utf8');
    const comment = path.substring(substrLen);
    const keys: string[] = [];
    for (const match of data.matchAll(treg)) {
      const key = match[1];
      if (sharedKeys.has(key)) {
        const previousComment = sharedKeys.get(key);
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

  const common: string[] = [];
  const multipleOccur: string[] = [];
  for (const [key, comment] of sharedKeys) {
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
  const out: string[] = ['# Common'].concat(common).concat(['']).concat(multipleOccur);
  for (const [comment, keys] of allFiles) {
    const uniqueKeys = keys.filter((key: string) => !sharedKeys.has(key));
    if (uniqueKeys.length) {
      out.push(`\n# ${comment}`);
      for (const key of uniqueKeys) {
        out.push(`"${key}": "${enMap[key] ?? key}"`);
      }
    }
  }

  fs.writeFileSync(enyaml, out.join('\n'));
}

main();
