import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Is this webhook really from Meta?
 *
 * The WhatsApp webhook is a public, unauthenticated URL. This signature is the
 * only thing between it and anyone who finds the address, so it is worth being
 * exact about three things:
 *
 * 1. It checks the RAW body, before parsing. Re-serialising the JSON would not
 *    reproduce the same bytes, so the check would fail for honest requests and
 *    the endpoint would be quietly dead.
 * 2. A check that CANNOT run is a check that fails. No secret configured, no
 *    raw body, no header - all refuse. The tempting shortcut is to skip
 *    verification when the secret is missing "until it is set up", which turns
 *    a locked door into a decoration.
 * 3. timingSafeEqual, not ===. String comparison returns early on the first
 *    wrong byte, which leaks how much of a guess was right.
 */
export const isValidMetaSignature = ({
  rawBody,
  header,
  appSecret,
}: {
  rawBody: string | null | undefined;
  header: string | null | undefined;
  appSecret: string | null | undefined;
}): boolean => {
  if (!appSecret || typeof rawBody !== 'string' || !header?.startsWith('sha256=')) {
    return false;
  }

  const provided = header.slice('sha256='.length);

  // Buffer.from on a non-hex string yields a short buffer rather than throwing,
  // so the length check below is what actually rejects a malformed signature.
  if (!/^[0-9a-f]*$/i.test(provided) || provided.length === 0) return false;

  const expectedBuffer = Buffer.from(
    createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex'),
    'hex',
  );
  const providedBuffer = Buffer.from(provided, 'hex');

  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
};

/** The header Meta sends it in, whichever way the proxy cased it. */
export const signatureHeaderOf = (
  headers: Record<string, string | undefined> | undefined,
) => headers?.['x-hub-signature-256'] ?? headers?.['X-Hub-Signature-256'];
