import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

async function main() {
  const output: string[] = [];

  const faIcons: string[] = glob.sync(`icons/font-awesome/**/*.svg`, {posix: true});
  for (const path of faIcons) {
    const paths = path.split('/');
    const fileName = paths.at(-1);
    const name = fileName.substring(0, fileName.length - 4);
    const folderName = paths[paths.length - 2];
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
    const data = fs
      .readFileSync(path, 'utf8')
      .trim()
      .replace('<path ', "<path fill='white' ")
      .replaceAll('"', "'")
      .replace(/</g, '%3C')
      .replace(/>/g, '%3E')
      .replace(/#/g, '%23');

    output.push(`
.tico-${group}-${name} {
  background-image: url("data:image/svg+xml,${data}");
}`);
  }

  fs.writeFileSync('css/icons.css', output.join('\n'));
}

main();
