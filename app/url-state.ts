/** URL parameters select startup state; later writes only update the address bar. */
export function initialUrlParams() {
  return new URLSearchParams(location.search);
}

export function replaceUrlQuery(changes: Record<string, string | null | undefined>) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(changes)) {
    if (value == null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  url.hash = '';
  if (url.href !== location.href) history.replaceState(history.state, '', url);
}
