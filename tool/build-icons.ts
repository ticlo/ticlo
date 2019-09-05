import * as fs from 'fs';
import * as path from 'path';
import * as glob from "glob";
import {exec} from 'child_process';


async function async_exec(cmd: string) {
  return new Promise((resolve, reject) => {
    exec(cmd, {cwd: __dirname, timeout: 100000}, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

}

async function main() {
  let output: string[] = [];

  let faIcons: string[] = glob.sync(`icons/font-awesome/**/*.svg`);
  for (let path of faIcons) {
    let paths = path.split('/');
    let fileName = paths[paths.length - 1];
    let name = fileName.substr(0, fileName.length - 4);
    let folderName = paths[paths.length - 2];
    let group: string;
    switch (folderName) {
      case 'solid':
        group = 'fas';
        break;
      case 'brands':
        group = 'fab';
        break;
      case 'regular':
        group = 'fa';
        break;
      default:
        continue;
    }
    let data = fs.readFileSync(path, 'utf8').replace('<path ', '<path fill="white" ')
      .replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23');

    output.push(`
.tico-${group}-${name} {
  background-image: url('data:image/svg+xml,${data}');
}`);
  }


  fs.writeFileSync('dist/icons.css', output.join('\n'));
}

main();