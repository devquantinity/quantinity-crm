/**
 * Turning a share token into a link a client can open.
 *
 * This exists because of a bug worth remembering: the front components built
 * the link from `globalThis.location.origin`, and inside Twenty's sandboxed
 * worker that is the STRING "null", not undefined. So `?? ''` never fired and
 * the clipboard got "null/s/invoice?token=...". The server knows its own
 * address; the browser side of an app does not.
 */

export const absoluteShareUrl = (
  path: string,
  headers: Record<string, string | undefined> | undefined,
  configuredBaseUrl?: string,
) => {
  // A configured base wins over anything in the request. Once this is deployed
  // the client opens the link on a public domain, which is not necessarily the
  // host whoever pressed Issue happened to be using.
  const base = (configuredBaseUrl ?? '').trim().replace(/\/+$/, '');

  if (/^https?:\/\/.+/i.test(base)) {
    return `${base}${path}`;
  }

  const header = (name: string) => {
    if (!headers) return undefined;
    const hit = Object.keys(headers).find(
      (key) => key.toLowerCase() === name && headers[key],
    );
    return hit ? headers[hit] : undefined;
  };

  const origin = header('origin');

  if (origin && /^https?:\/\/.+/i.test(origin)) {
    return `${origin.replace(/\/+$/, '')}${path}`;
  }

  const host = header('x-forwarded-host') ?? header('host');

  if (host) {
    const proto =
      header('x-forwarded-proto') ??
      (/^(localhost|127\.|\[::1\])/i.test(host) ? 'http' : 'https');

    return `${proto}://${host}${path}`;
  }

  return path;
};

/**
 * Front-component side. Returns '' rather than a link that looks real and is
 * not - a broken link on a clipboard is worse than no link, because it gets
 * pasted to a client before anyone reads it.
 */
export const resolveShareLink = (
  shareUrl: string | undefined | null,
  origin: string | undefined | null,
) => {
  if (!shareUrl) return '';
  if (/^https?:\/\//i.test(shareUrl)) return shareUrl;

  const base =
    origin && origin !== 'null' && /^https?:\/\/.+/i.test(origin)
      ? origin.replace(/\/+$/, '')
      : '';

  return base ? `${base}${shareUrl}` : '';
};
