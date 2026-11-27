import {finishBrowserOAuth} from '@ticlo/oauth/browser-callback';

const url = new URL(location.href);
history.replaceState(null, '', url.pathname);
document.getElementById('status').textContent = finishBrowserOAuth(url)
  ? 'Return to Ticlo to check the result. You can close this tab.'
  : 'This authorization link is invalid.';
