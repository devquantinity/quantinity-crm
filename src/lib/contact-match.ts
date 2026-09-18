import { normaliseHandle } from 'src/lib/messaging';

/**
 * Which contact is this number?
 *
 * Twenty stores a phone in pieces - "+60" in primaryPhoneCallingCode and
 * "123456789" in primaryPhoneNumber - and people also paste the whole thing
 * into the number field and leave the calling code empty. WhatsApp always gives
 * the full international number. So a plain string comparison finds almost
 * nothing, and matching has to try both shapes.
 *
 * The rule, and the reason for it: an exact match wins outright. Otherwise a
 * number stored without its country code can still match by suffix - but ONLY
 * if exactly one contact matches that way. Gotka takes the first suffix match
 * it finds; that is a coin toss when two people's numbers end the same, and
 * losing it means a client's WhatsApp thread opens under somebody else's name
 * and the reply goes to the wrong person. An unattached conversation is a small
 * annoyance. A misattached one is a data breach with a friendly face.
 */

export type PhoneParts = {
  number?: string | null;
  callingCode?: string | null;
};

export type ContactLike = {
  id: string;
  phones?: {
    primaryPhoneNumber?: string | null;
    primaryPhoneCallingCode?: string | null;
    additionalPhones?: ReadonlyArray<PhoneParts> | null;
  } | null;
  company?: { id?: string | null } | null;
};

const digitsOf = (value: string | null | undefined) =>
  String(value ?? '').replace(/\D/g, '');

/** Every way one contact's numbers could be written, as bare digits. */
export const contactDigits = (contact: ContactLike): string[] => {
  const parts: PhoneParts[] = [
    {
      number: contact.phones?.primaryPhoneNumber,
      callingCode: contact.phones?.primaryPhoneCallingCode,
    },
    ...(contact.phones?.additionalPhones ?? []),
  ];

  const spellings = new Set<string>();

  parts.forEach((part) => {
    const number = digitsOf(part.number);

    if (!number) return;

    const calling = digitsOf(part.callingCode);

    // As stored, in case the whole number went into the number field...
    spellings.add(number);
    // ...and with the calling code, which is where it usually lives.
    if (calling) spellings.add(`${calling}${number.replace(/^0+/, '')}`);
    // ...and through the local-number rule, for "012-345 6789" typed whole.
    const normalised = digitsOf(normaliseHandle(number));
    if (normalised) spellings.add(normalised);
  });

  return [...spellings];
};

export type ContactMatch = {
  personId: string | null;
  companyId: string | null;
  /** Why, in words - for a log line that explains itself a month later. */
  reason: string;
};

const NO_MATCH: ContactMatch = {
  personId: null,
  companyId: null,
  reason: 'no contact has this number',
};

const MIN_SUFFIX_DIGITS = 8;

/**
 * The last few digits, for narrowing 1,200 contacts down to a handful.
 *
 * Pulling every contact and matching in memory is fine at demo scale and quietly
 * wrong at real scale: the query caps out, the contacts past the cap never
 * match, and nobody finds out because an unmatched conversation looks exactly
 * like a number you have never dealt with. So the database narrows first on a
 * cheap suffix, and the careful rule above runs on what comes back.
 *
 * Seven digits, because that is short enough to survive a number stored without
 * its country code or its leading zero, and long enough to return a handful
 * rather than a page.
 */
export const NARROWING_DIGITS = 7;

export const narrowingSuffix = (handle: string) => {
  const digits = digitsOf(normaliseHandle(handle));

  return digits.length >= NARROWING_DIGITS ? digits.slice(-NARROWING_DIGITS) : '';
};

export const matchContact = ({
  handle,
  contacts,
}: {
  handle: string;
  contacts: readonly ContactLike[];
}): ContactMatch => {
  const wanted = digitsOf(normaliseHandle(handle));

  if (!wanted) return { ...NO_MATCH, reason: 'that is not a usable number' };

  const suffixCandidates: ContactLike[] = [];

  for (const contact of contacts) {
    const spellings = contactDigits(contact);

    if (spellings.includes(wanted)) {
      return {
        personId: contact.id,
        companyId: contact.company?.id ?? null,
        reason: 'exact match',
      };
    }

    const suffixHit = spellings.some(
      (spelling) =>
        spelling.length >= MIN_SUFFIX_DIGITS && wanted.endsWith(spelling),
    );

    if (suffixHit) suffixCandidates.push(contact);
  }

  if (suffixCandidates.length === 1) {
    return {
      personId: suffixCandidates[0].id,
      companyId: suffixCandidates[0].company?.id ?? null,
      reason: 'matched on the number without its country code',
    };
  }

  if (suffixCandidates.length > 1) {
    // Deliberately nobody. See the note at the top of this file.
    return {
      ...NO_MATCH,
      reason: `${suffixCandidates.length} contacts end with this number, so it is not safe to guess`,
    };
  }

  return NO_MATCH;
};
