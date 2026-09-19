import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { isValidMetaSignature, signatureHeaderOf } from 'src/lib/webhook-signature';

const SECRET = 'meta-app-secret';
const BODY = '{"object":"whatsapp_business_account","entry":[{"id":"1"}]}';

const sign = (body: string, secret = SECRET) =>
  `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;

describe('isValidMetaSignature', () => {
  it('accepts a body Meta really signed', () => {
    expect(
      isValidMetaSignature({ rawBody: BODY, header: sign(BODY), appSecret: SECRET }),
    ).toBe(true);
  });

  it('rejects a body that was changed after signing', () => {
    // The attack this exists for: a real signature replayed over edited content.
    const tampered = BODY.replace('"1"', '"999"');

    expect(
      isValidMetaSignature({ rawBody: tampered, header: sign(BODY), appSecret: SECRET }),
    ).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    expect(
      isValidMetaSignature({
        rawBody: BODY,
        header: sign(BODY, 'someone-elses-secret'),
        appSecret: SECRET,
      }),
    ).toBe(false);
  });

  it('refuses when there is no secret configured', () => {
    // The tempting shortcut is to skip the check "until it is set up", which
    // turns a locked door into a decoration on a public URL.
    expect(isValidMetaSignature({ rawBody: BODY, header: sign(BODY), appSecret: '' })).toBe(
      false,
    );
    expect(
      isValidMetaSignature({ rawBody: BODY, header: sign(BODY), appSecret: null }),
    ).toBe(false);
  });

  it('refuses when there is no raw body to check', () => {
    // A parsed body cannot be re-serialised to the same bytes, so a check that
    // cannot run must fail rather than wave the request through.
    expect(
      isValidMetaSignature({ rawBody: undefined, header: sign(BODY), appSecret: SECRET }),
    ).toBe(false);
  });

  it('refuses a missing or malformed header', () => {
    expect(isValidMetaSignature({ rawBody: BODY, header: undefined, appSecret: SECRET })).toBe(false);
    expect(isValidMetaSignature({ rawBody: BODY, header: '', appSecret: SECRET })).toBe(false);
    expect(isValidMetaSignature({ rawBody: BODY, header: 'sha256=', appSecret: SECRET })).toBe(false);
    expect(isValidMetaSignature({ rawBody: BODY, header: 'notasig', appSecret: SECRET })).toBe(false);
    expect(
      isValidMetaSignature({ rawBody: BODY, header: 'sha1=abcdef', appSecret: SECRET }),
    ).toBe(false);
  });

  it('refuses a signature that is not hex, instead of throwing', () => {
    // Buffer.from on junk yields a short buffer rather than an error, so an
    // unguarded version would compare two empty buffers and pass.
    expect(
      isValidMetaSignature({ rawBody: BODY, header: 'sha256=zzzz', appSecret: SECRET }),
    ).toBe(false);
    expect(
      isValidMetaSignature({ rawBody: BODY, header: 'sha256=!!!!', appSecret: SECRET }),
    ).toBe(false);
  });

  it('refuses a truncated signature', () => {
    const real = sign(BODY);

    expect(
      isValidMetaSignature({ rawBody: BODY, header: real.slice(0, 20), appSecret: SECRET }),
    ).toBe(false);
  });

  it('accepts an empty body that was genuinely signed', () => {
    expect(isValidMetaSignature({ rawBody: '', header: sign(''), appSecret: SECRET })).toBe(
      true,
    );
  });
});

describe('signatureHeaderOf', () => {
  it('finds the header whichever way it was cased', () => {
    expect(signatureHeaderOf({ 'x-hub-signature-256': 'sha256=a' })).toBe('sha256=a');
    expect(signatureHeaderOf({ 'X-Hub-Signature-256': 'sha256=b' })).toBe('sha256=b');
  });

  it('returns nothing when it is absent', () => {
    expect(signatureHeaderOf({})).toBeUndefined();
    expect(signatureHeaderOf(undefined)).toBeUndefined();
  });
});
