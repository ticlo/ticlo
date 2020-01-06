import fs from 'fs';
import shelljs from 'shelljs';
import * as glob from 'glob';

let version: string;
let dependencies: any;

let dirHistory = new Set<string>();
function makeDir(path: string) {
  if (path.lastIndexOf('.') > path.length - 5) {
    // when there is extension, use parent folder
    path = path.substring(0, path.lastIndexOf('/'));
  }
  if (dirHistory.has(path)) {
    return;
  }
  dirHistory.add('path');
  shelljs.mkdir('-p', path);
}

async function buildPackage(name: string, replaceImport = true) {
  let fromDir = `./src/${name}`;
  let targetDir = `./node_modules/@ticlo/${name}`;

  // copy files
  makeDir(targetDir);
  shelljs.cp(`./packages/tsconfig.json`, targetDir);

  // copy ts files
  let srcFiles: string[] = glob.sync(`${fromDir}/**/*.{ts,tsx}`);
  let convertedFiles: string[] = [];
  for (let tsFile of srcFiles) {
    if (!tsFile.includes('/spec/')) {
      let data = fs.readFileSync(tsFile, {encoding: 'utf8'});
      if (replaceImport) {
        data = data.replace(/from '(..\/)+src\//g, "from '@ticlo/");
      }
      let newFile = tsFile.replace(fromDir, targetDir);
      convertedFiles.push(newFile);
      makeDir(newFile);
      fs.writeFileSync(newFile, data);
    }
  }

  // update package.json
  let packageJson: any = JSON.parse(fs.readFileSync(`./packages/${name}/package.json`, {encoding: 'utf8'}));
  packageJson.version = version;
  let deps = packageJson.dependencies;
  for (let key in deps) {
    // sync dependencies
    if (!key.startsWith('@ticlo/')) {
      packageJson.dependencies[key] = dependencies[key];
    }
  }
  fs.writeFileSync(`${targetDir}/package.json`, JSON.stringify(packageJson, null, 2));

  // run tsc
  shelljs.pushd(targetDir);
  shelljs.exec('..\\..\\.bin\\tsc');
  shelljs.popd();

  // delete ts files
  shelljs.rm(convertedFiles);
}

async function main() {
  makeDir('./node_modules/@ticlo');
  let packageJson = JSON.parse(fs.readFileSync('package.json', {encoding: 'utf8'}));
  version = packageJson.version;
  dependencies = {...packageJson.dependencies, ...packageJson.devDependencies};
  await buildPackage('core', false);
  await buildPackage('editor');
}

main();
