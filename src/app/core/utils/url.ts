/**
 * Host of the url (with its port, if any), which is a valid CSP host source. Empty for a
 * missing or invalid url.
 */
export function getUrlHost(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}
