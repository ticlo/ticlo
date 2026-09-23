import Fs from 'node:fs/promises';
import Path from 'node:path';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {encodeSorted} from '@ticlo/core';
import {data} from '../sample-data/data.ts';

const dir = fileURLToPath(new URL('./files/', import.meta.url));

async function indexFolder(folder: string) {
  const files: string[] = [];
  for (const entry of await Fs.readdir(folder, {withFileTypes: true})) {
    if (entry.name.startsWith('.') || entry.name === '_proj.json') {
      continue;
    }
    if (entry.isDirectory()) {
      await indexFolder(Path.join(folder, entry.name));
      files.push(`${entry.name}/`);
    } else if (entry.isFile()) {
      files.push(entry.name);
    }
  }
  await Fs.writeFile(Path.join(folder, '.list.json'), JSON.stringify(files.sort(), null, 2));
}

async function seed(path: string, content: string) {
  try {
    await Fs.writeFile(path, content, {flag: 'wx'});
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

async function start() {
  const rootProject = Path.join(dir, 'proj/_root');
  await Fs.mkdir(rootProject, {recursive: true});
  await Fs.mkdir(Path.join(dir, 'usr'), {recursive: true});
  await seed(Path.join(rootProject, '_proj.json'), JSON.stringify({id: '_root', name: 'Root'}));
  await seed(Path.join(rootProject, '#global.ticlo'), encodeSorted({'#is': ''}));
  await seed(Path.join(rootProject, 'example.ticlo'), encodeSorted(data));
  await indexFolder(dir);

  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, {Allow: 'GET, HEAD'}).end();
      return;
    }
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = Path.resolve(dir, `.${path}`);
      const relative = Path.relative(dir, file);
      if (!relative.startsWith(`proj${Path.sep}`) && !relative.startsWith(`usr${Path.sep}`)) {
        res.writeHead(404).end();
        return;
      }
      const content = await Fs.readFile(file);
      res.writeHead(200, {
        'Content-Type': file.endsWith('.json') ? 'application/json' : 'text/plain; charset=utf-8',
        'Content-Length': content.length,
      });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'EISDIR' || code === 'ENOTDIR') {
        res.writeHead(404).end();
      } else if (error instanceof URIError) {
        res.writeHead(400).end();
      } else {
        console.error(error);
        res.writeHead(500).end();
      }
    }
  });
  server.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
  server.listen(8011, '127.0.0.1', () => {
    console.log('Static storage listening on http://127.0.0.1:8011');
    console.log('Run pnpm vite-dev, then open http://localhost:3003/static-server.html');
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
