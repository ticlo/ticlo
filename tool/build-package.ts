import fs from 'fs';
import {normalize} from 'path';
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

async function buildPackage(name: string) {
  let fromDir = `packages/${name}`;
  console.log(`building ${fromDir}`);
  // build package directly into node_modules, so one package can depend on the other
  let targetDir = `./build/${name}`;
  console.log(targetDir);
  makeDir(targetDir);
  // copy tsconfig
  shelljs.cp('./tool/package-tsconfig.json', targetDir);
  shelljs.mv(`${targetDir}/package-tsconfig.json`, `${targetDir}/tsconfig.json`);

  // copy+analyze+convert ts files

  const importedPackages = new Set<string>();
  const regex = / from '([^@'.\/]+|@[^'.\/]+\/[^'.\/]+)/g;

  let srcFiles: string[] = glob.sync(`${fromDir}/**/*.{ts,tsx}`, {posix: true});
  let sourceFiles: string[] = [`${targetDir}/tsconfig.json`]; // files to be deleted after compiling
  for (let tsFile of srcFiles) {
    if (!tsFile.includes('/__spec__/') && !tsFile.includes('/tests/')) {
      let data = fs.readFileSync(tsFile, {encoding: 'utf8'});

      // analyze file, and fix file content
      // TODO, nothing needs to be fixed for now

      // copy file to build
      let newFile = tsFile.replace(fromDir, targetDir);
      sourceFiles.push(newFile);
      makeDir(newFile);
      fs.writeFileSync(newFile, data);
    }
  }

  // update package.json
  let packageJson: any = JSON.parse(fs.readFileSync(`${fromDir}/_package.json`, {encoding: 'utf8'}));
  packageJson.version = version;
  for (let p of importedPackages) {
    // sync dependencies
    if (!p.startsWith('@ticlo/')) {
      packageJson.dependencies[p] = dependencies[p];
    } else {
      delete packageJson.dependencies[p];
    }
  }
  fs.writeFileSync(`${targetDir}/package.json`, JSON.stringify(packageJson, null, 2));

  // run tsc
  shelljs.pushd('-q', targetDir);
  console.log(`compiling ${targetDir}`);
  shelljs.echo(shelljs.exec(normalize('../../node_modules/.bin/tsc')).stdout);
  shelljs.popd('-q');

  // delete ts files
  shelljs.rm(sourceFiles);
}

async function main() {
  makeDir('build');
  let packageJson = JSON.parse(fs.readFileSync('package.json', {encoding: 'utf8'}));
  version = packageJson.version;
  dependencies = {...packageJson.dependencies, ...packageJson.devDependencies};

  await buildPackage('core');

  await buildPackage('html');

  // await buildPackage('editor');
  // shelljs.cp('./dist/*.css', './build/editor');
  //
  // await buildPackage('react');
  await buildPackage('react-hooks');
  //
  // await buildPackage('node');
  //
  // await buildPackage('express');
}

main();
