let loaders: {[key: string]: Promise<Response>};

if ('ticloFetch' in window) {
  loaders = (window as any).ticloFetch;
  setTimeout(() => {
    // free memory after 10 seconds
    loaders = null;
  }, 10000);
}

// api to fetch data from url, this allow html to fetch data before the main js is loaded
export function preFetch(url: string): Promise<Response> {
  if (loaders && url in loaders) {
    return loaders[url];
  }
  return fetch(url);
}

// example of using preFetch

/*
// in html, before the main js is loaded
<script>
window.ticloFetch = {
  '/data.json': fetch('./data.json');
}
</script>
*/
