export const oauthChannelName = (state: string) => `ticlo-oauth-${state}`;

// The callback runs on the browser runtime's origin, including when its editor is in a separate window.
export function finishBrowserOAuth(url: URL) {
  const state = url.searchParams.get('state');
  if (!state || !/^[\w-]{43}$/.test(state)) return false;
  const channel = new BroadcastChannel(oauthChannelName(state));
  channel.postMessage({
    state,
    code: url.searchParams.get('code'),
    error: url.searchParams.get('error'),
    iss: url.searchParams.get('iss'),
    callback: url.pathname,
    provider: url.searchParams.get('provider'),
  });
  channel.close();
  return true;
}
