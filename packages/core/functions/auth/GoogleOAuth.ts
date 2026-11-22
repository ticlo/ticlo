import {isBearerToken, oauthLifetime, type OAuthPopupResult} from './OAuth.ts';

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: string | number;
  scope?: string;
  error?: string;
}

interface GoogleOAuth {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    include_granted_scopes: boolean;
    callback(response: GoogleTokenResponse): void;
    error_callback(error: {type: string}): void;
  }): {requestAccessToken(): void};
}

let sdk: Promise<GoogleOAuth> | undefined;

function getGoogleOAuth() {
  return (window as Window & {google?: {accounts?: {oauth2?: GoogleOAuth}}}).google?.accounts?.oauth2;
}

function loadGoogleOAuth() {
  const existing = getGoogleOAuth();
  if (existing) return Promise.resolve(existing);
  sdk ??= new Promise<GoogleOAuth>((resolve, reject) => {
    const script = document.createElement('script');
    const failed = () => {
      script.remove();
      reject(new Error('Could not load Google Identity Services.'));
    };
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      const oauth = getGoogleOAuth();
      if (oauth) resolve(oauth);
      else failed();
    };
    script.onerror = failed;
    document.head.append(script);
  }).catch((error) => {
    sdk = undefined;
    throw error;
  });
  return sdk;
}

export async function prepareGoogleOAuth(clientId: string, scope: string, resourceOrigin: string) {
  if (!clientId || !scope) throw new Error('Google OAuth requires a client ID and scope.');
  if (resourceOrigin !== 'https://www.googleapis.com') {
    throw new Error('Google OAuth uses https://www.googleapis.com as its resource origin.');
  }
  const oauth = await loadGoogleOAuth();
  return function authorize() {
    let timeout: ReturnType<typeof setTimeout>;
    return new Promise<OAuthPopupResult>((resolve) => {
      timeout = setTimeout(() => resolve('authorization-cancelled'), oauthLifetime);
      const client = oauth.initTokenClient({
        client_id: clientId,
        scope,
        include_granted_scopes: false,
        callback(response) {
          const lifetime = Number(response.expires_in);
          if (response.error === 'access_denied') {
            resolve('authorization-denied');
          } else if (
            response.error ||
            typeof response.scope !== 'string' ||
            !isBearerToken(response.access_token) ||
            !Number.isFinite(lifetime) ||
            lifetime <= 0
          ) {
            resolve('authorization-failed');
          } else {
            resolve({
              accessToken: response.access_token,
              expiresAt: Date.now() + lifetime * 1000,
              scope: response.scope,
            });
          }
        },
        error_callback(error) {
          resolve(error.type === 'popup_closed' ? 'authorization-cancelled' : 'authorization-failed');
        },
      });
      client.requestAccessToken();
    }).finally(() => clearTimeout(timeout));
  };
}
