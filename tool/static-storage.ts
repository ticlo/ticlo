import type {Dirent} from 'node:fs';
import {copyFile, mkdir, readdir, readFile, realpath, writeFile} from 'node:fs/promises';
import type {IncomingMessage, ServerResponse} from 'node:http';
import path from 'node:path';
import {lookUpMimeType} from '../packages/file-server/mimeTypes.ts';

async function staticEntries(directory: string) {
  return (await readdir(directory, {withFileTypes: true})).filter(
    (entry) =>
      (entry.isDirectory() && !entry.name.startsWith('.')) ||
      (entry.isFile() && (entry.name === '.proj' || !entry.name.startsWith('.')))
  );
}

function directoryIndex(entries: Dirent[]) {
  return JSON.stringify(
    entries
      .filter(({name}) => name !== '.proj')
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
      .sort()
  );
}

export async function copyStaticStorage(source: string, destination: string) {
  const entries = await staticEntries(source);
  await mkdir(destination, {recursive: true});
  await writeFile(path.join(destination, '.list.json'), directoryIndex(entries));
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyStaticStorage(from, to);
    else await copyFile(from, to);
  }
}

export async function serveStaticStorage(directory: string, generateIndexes = false) {
  const root = await realpath(directory);
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, {Allow: 'GET, HEAD'}).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, `.${pathname}`);
      const relative = path.relative(root, file);
      const parts = relative.split(path.sep);
      const name = parts.pop();
      if (
        path.isAbsolute(relative) ||
        parts.some((part) => part.startsWith('.')) ||
        (name.startsWith('.') && name !== '.list.json' && name !== '.proj')
      ) {
        res.writeHead(404).end();
        return;
      }
      const isIndex = name === '.list.json';
      const indexDirectory = isIndex && generateIndexes ? path.dirname(file) : undefined;
      const entry = indexDirectory ?? file;
      if ((await realpath(entry)) !== entry) {
        res.writeHead(404).end();
        return;
      }
      const data = indexDirectory ? directoryIndex(await staticEntries(indexDirectory)) : await readFile(entry);
      const contentType =
        isIndex || name === '.proj' || name.endsWith('.ticlo') ? 'application/json' : lookUpMimeType(file);
      res.writeHead(200, {'Content-Type': contentType, 'Cache-Control': 'no-store'});
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const missing = code === 'ENOENT' || code === 'EISDIR' || code === 'ENOTDIR';
      res.writeHead(error instanceof URIError ? 400 : missing ? 404 : 500).end();
    }
  };
}
