/**
 * Escaping for the two documents a client actually opens.
 *
 * There were two copies of this, one in invoice-document.ts and one inlined in
 * public-quote-page.ts, identical for now. That is how a security fix gets
 * applied to one page and not the other, and nobody notices until the page
 * nobody remembered is the one that matters.
 *
 * The single quote is escaped too. Nothing in either template currently puts a
 * value inside a single-quoted attribute, so today it changes nothing - but
 * "today it changes nothing" is the whole reason it is cheap to do now and
 * expensive to discover later, when somebody writes class='...' and the client
 * name is <img src=x onerror=...>.
 *
 * These pages are public and unauthenticated: the content comes from records
 * the business types, and the reader is the client.
 */
export const escapeHtml = (value: unknown) =>
  String(value ?? '')
    // Ampersand first. Any other order double-escapes what the others produce.
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
