import {Block} from '../../block/Block.ts';
import {BaseFunction} from '../../block/BlockFunction.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';
import {Library} from '../../block/Library.ts';
import {classifyFilePath} from '../../storage/FilePath.ts';

function defaultResolveFileUrl(path: string): string | undefined {
  const kind = classifyFilePath(path);
  return kind === 'url' || kind === 'external' ? path : undefined;
}

export function applyUrlHost(url: string, rawHost: unknown): string {
  if (typeof rawHost !== 'string') return url;
  const host = rawHost.trim().replace(/\/+$/, '');
  if (!host || url.startsWith('blob:') || url.startsWith('data:')) return url;

  const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(host) || host.startsWith('//');
  if (url.startsWith('//') || /^https?:\/\//i.test(url)) {
    const match = /^(https?:)?\/\/[^/?#]+(.*)$/i.exec(url);
    if (!match) return url;
    const origin = hasProtocol ? host : `${match[1] ?? ''}//${host}`;
    return `${origin}${match[2]}`;
  }

  const baseOrigin = hasProtocol ? host : `https://${host}`;
  if (url.startsWith('/')) {
    return `${baseOrigin}${url}`;
  }
  try {
    const resolved = new URL(url, `${baseOrigin.startsWith('//') ? `https:${baseOrigin}` : baseOrigin}/`);
    if (baseOrigin.startsWith('//')) {
      return `//${resolved.host}${resolved.pathname}${resolved.search}${resolved.hash}`;
    }
    return resolved.href;
  } catch {
    return `${baseOrigin}/${url.replace(/^\.\//, '')}`;
  }
}

function formatOutputUrl(url: string | undefined, host: unknown, css: unknown): string | undefined {
  if (!url) return undefined;
  const finalUrl = applyUrlHost(url, host);
  if (!css) return finalUrl;
  const escaped = finalUrl.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\r', '').replaceAll('\n', '');
  return `url('${escaped}')`;
}

export class ToUrlFunction extends BaseFunction {
  private revision = 0;

  run(): any {
    const revision = ++this.revision;
    const rawPath = this._data.getValue('path');
    if (typeof rawPath !== 'string' || !rawPath) {
      this._data.output(undefined);
      return;
    }
    const host = this._data.getValue('host');
    const css = Boolean(this._data.getValue('css'));
    const flow = this._data instanceof Block ? this._data._flow : undefined;
    const storage = flow ? Library.rootOf(flow)._storage : undefined;
    const resolved = storage?.resolveFileUrl
      ? storage.resolveFileUrl(rawPath, flow._library)
      : defaultResolveFileUrl(rawPath);

    if (resolved instanceof Promise) {
      return resolved.then((url) => {
        if (revision !== this.revision || !this._data) return;
        this._data.output(formatOutputUrl(url, host, css));
      });
    }
    this._data.output(formatOutputUrl(resolved, host, css));
  }

  cancel(): boolean {
    ++this.revision;
    return true;
  }

  cleanup(): void {
    ++this.revision;
    this._data.output(undefined);
  }

  destroy(): void {
    ++this.revision;
    super.destroy();
  }
}

globalFunctions.addFactory(
  ToUrlFunction,
  {
    name: 'toUrl',
    icon: '15:url',
    priority: 0,
    properties: [
      {name: 'path', type: 'file-path', pinned: true},
      {name: 'host', type: 'string'},
      {name: 'css', type: 'toggle', default: false},
      {name: '#output', type: 'string', readonly: true, pinned: true},
    ],
  },
  'file'
);
