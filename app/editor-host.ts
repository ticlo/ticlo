const defaultRuntimeUrl = 'http://127.0.0.1:8010/ticlo';

export function editorHostUrls(host?: string | null) {
  const runtime = new URL(host || defaultRuntimeUrl);
  if (runtime.protocol === 'ws:') runtime.protocol = 'http:';
  if (runtime.protocol === 'wss:') runtime.protocol = 'https:';
  if (runtime.protocol !== 'http:' && runtime.protocol !== 'https:') throw new Error('Invalid editor host');

  const rootHost = runtime.pathname.endsWith('/');
  const base = rootHost ? runtime : runtime.pathname.endsWith('/ticlo') ? new URL('./', runtime) : null;
  return {
    runtimeUrl: rootHost ? new URL('ticlo', runtime).href : runtime.href,
    fileUrl: base ? new URL('file', base).href : undefined,
  };
}
