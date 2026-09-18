import { describe, expect, it } from 'vitest';

import {
  contactDigits,
  matchContact,
  narrowingSuffix,
  type ContactLike,
} from 'src/lib/contact-match';

const person = (
  id: string,
  phones: ContactLike['phones'],
  companyId?: string,
): ContactLike => ({ id, phones, company: companyId ? { id: companyId } : null });

// The way Twenty actually stores a phone once you use its editor.
const split = person('split', {
  primaryPhoneNumber: '123456789',
  primaryPhoneCallingCode: '+60',
});

// The way it ends up when somebody pastes the whole thing in.
const whole = person('whole', { primaryPhoneNumber: '0123456789' });

describe('contactDigits', () => {
  it('knows the split form joins back into a full number', () => {
    expect(contactDigits(split)).toContain('60123456789');
  });

  it('keeps a pasted local number and its international form', () => {
    const spellings = contactDigits(whole);

    expect(spellings).toContain('0123456789');
    expect(spellings).toContain('60123456789');
  });

  it('covers second and third numbers too', () => {
    const spellings = contactDigits(
      person('multi', {
        primaryPhoneNumber: '111111111',
        primaryPhoneCallingCode: '+60',
        additionalPhones: [{ number: '987654321', callingCode: '+65' }],
      }),
    );

    expect(spellings).toContain('60111111111');
    expect(spellings).toContain('65987654321');
  });

  it('says nothing about a contact with no phone', () => {
    expect(contactDigits(person('empty', null))).toEqual([]);
    expect(contactDigits(person('blank', { primaryPhoneNumber: '' }))).toEqual([]);
  });
});

describe('matchContact', () => {
  it('finds the contact whose number is stored in pieces', () => {
    const match = matchContact({ handle: '+60123456789', contacts: [split] });

    expect(match.personId).toBe('split');
    expect(match.reason).toBe('exact match');
  });

  it('finds the contact who pasted the whole number in', () => {
    const match = matchContact({ handle: '+60123456789', contacts: [whole] });

    expect(match.personId).toBe('whole');
  });

  it('carries the company across so the inbox row can show it', () => {
    const match = matchContact({
      handle: '+60123456789',
      contacts: [person('p', { primaryPhoneNumber: '0123456789' }, 'acme')],
    });

    expect(match.personId).toBe('p');
    expect(match.companyId).toBe('acme');
  });

  it('matches a number filed without its country code', () => {
    const match = matchContact({
      handle: '+60123456789',
      contacts: [person('nocode', { primaryPhoneNumber: '123456789' })],
    });

    expect(match.personId).toBe('nocode');
    expect(match.reason).toContain('without its country code');
  });

  it('refuses to guess when two contacts end with the same number', () => {
    // The whole point. Picking one here would open a client's WhatsApp thread
    // under somebody else's name, and send the reply to the wrong person.
    const match = matchContact({
      handle: '+60123456789',
      contacts: [
        person('one', { primaryPhoneNumber: '123456789' }),
        person('two', { primaryPhoneNumber: '123456789' }),
      ],
    });

    expect(match.personId).toBeNull();
    expect(match.reason).toContain('not safe to guess');
  });

  it('still takes an exact match even when others match by suffix', () => {
    const match = matchContact({
      handle: '+60123456789',
      contacts: [
        person('suffix', { primaryPhoneNumber: '123456789' }),
        split,
        person('another', { primaryPhoneNumber: '123456789' }),
      ],
    });

    expect(match.personId).toBe('split');
    expect(match.reason).toBe('exact match');
  });

  it('will not match on a short tail that half the country shares', () => {
    const match = matchContact({
      handle: '+60123456789',
      contacts: [person('short', { primaryPhoneNumber: '6789' })],
    });

    expect(match.personId).toBeNull();
  });

  it('comes back empty rather than wrong', () => {
    expect(matchContact({ handle: '+60999999999', contacts: [split] }).personId).toBeNull();
    expect(matchContact({ handle: '', contacts: [split] }).personId).toBeNull();
    expect(matchContact({ handle: '+60123456789', contacts: [] }).personId).toBeNull();
  });
});

describe('narrowingSuffix', () => {
  it('is the tail the database can cheaply filter on', () => {
    expect(narrowingSuffix('+60123456789')).toBe('3456789');
    expect(narrowingSuffix('012-345 6789')).toBe('3456789');
  });

  it('is the same tail however the number was written', () => {
    // The point: one query has to find a contact whether their number was
    // stored whole, split across a calling code, or typed with dashes.
    expect(narrowingSuffix('+60 12 345 6789')).toBe(narrowingSuffix('60123456789'));
  });

  it('gives nothing rather than a tail so short it matches everyone', () => {
    expect(narrowingSuffix('12345')).toBe('');
    expect(narrowingSuffix('')).toBe('');
  });
});
