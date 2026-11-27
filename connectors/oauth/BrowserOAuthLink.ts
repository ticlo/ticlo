import {AuthorizationRequiredError} from '@ticlo/core';
import {beginOAuth, exchangeOAuth, type OAuthClient, type OAuthGrant} from './OAuth.ts';
import {oauthChannelName} from './OAuthBrowserCallback.ts';

// Starting a new transaction also invalidates an earlier code exchange that is still in flight.
export function browserOAuthLink(
  client: OAuthClient,
  issuer: string,
  valid: () => boolean,
  accept: (grant: OAuthGrant) => void,
  setStatus: (status: string) => void
) {
  const callback = new URL(client.redirectUri);
  let generation = 0;
  let channel: BroadcastChannel;
  let timer: ReturnType<typeof setTimeout>;
  function close() {
    ++generation;
    clearTimeout(timer);
    channel?.close();
  }
  async function start() {
    close();
    const id = generation;
    const current = () => id === generation && valid();
    const transaction = await beginOAuth(client);
    if (!current()) throw new AuthorizationRequiredError();
    channel = new BroadcastChannel(oauthChannelName(transaction.state));
    const expire = () => {
      close();
      setStatus('authorization-expired');
    };
    timer = setTimeout(expire, transaction.expires - Date.now());
    channel.onmessage = async ({data, origin}) => {
      if (
        !current() ||
        origin !== callback.origin ||
        data?.state !== transaction.state ||
        data.callback !== callback.pathname ||
        data.provider !== issuer ||
        (data.iss !== null && data.iss !== issuer)
      )
        return;
      if (Date.now() >= transaction.expires) {
        expire();
        return;
      }
      clearTimeout(timer);
      channel.close();
      if (data.error || typeof data.code !== 'string' || !data.code) {
        setStatus(data.error === 'access_denied' ? 'authorization-denied' : 'authorization-failed');
        return;
      }
      try {
        const grant = await exchangeOAuth(client, data.code, transaction.verifier, client.scope);
        if (current()) accept(grant);
      } catch {
        if (current()) setStatus('authorization-failed');
      }
    };
    setStatus('authorization-pending');
    return transaction.url;
  }
  return {start, close};
}
