import { describe, expect, it } from 'vitest';

import { absoluteShareUrl, resolveShareLink } from 'src/lib/share-url';
import { billToSnapshotFromCompany, isBillToEmpty } from 'src/lib/document-parties';

describe('absoluteShareUrl', () => {
  it('uses the request origin', () => {
    expect(absoluteShareUrl('/s/invoice?token=x', { origin: 'http://localhost:2020' })).toBe(
      'http://localhost:2020/s/invoice?token=x',
    );
  });

  it('does not care how the header is capitalised', () => {
    expect(absoluteShareUrl('/s/quote?token=x', { Origin: 'https://crm.example.com' })).toBe(
      'https://crm.example.com/s/quote?token=x',
    );
  });

  it('falls back to host, assuming http only for localhost', () => {
    expect(absoluteShareUrl('/s/invoice?token=x', { host: 'localhost:2020' })).toBe(
      'http://localhost:2020/s/invoice?token=x',
    );
    expect(absoluteShareUrl('/s/invoice?token=x', { host: 'crm.example.com' })).toBe(
      'https://crm.example.com/s/invoice?token=x',
    );
  });

  it('honours a forwarded protocol', () => {
    expect(
      absoluteShareUrl('/s/invoice?token=x', {
        host: 'crm.example.com',
        'x-forwarded-proto': 'http',
      }),
    ).toBe('http://crm.example.com/s/invoice?token=x');
  });

  it('returns the bare path when the request says nothing useful', () => {
    expect(absoluteShareUrl('/s/invoice?token=x', {})).toBe('/s/invoice?token=x');
    expect(absoluteShareUrl('/s/invoice?token=x', undefined)).toBe('/s/invoice?token=x');
  });
});

describe('resolveShareLink', () => {
  it('passes an absolute url straight through', () => {
    expect(resolveShareLink('http://localhost:2020/s/invoice?token=x', 'null')).toBe(
      'http://localhost:2020/s/invoice?token=x',
    );
  });

  it('refuses to build a link from the string "null" - the bug this exists for', () => {
    expect(resolveShareLink('/s/invoice?token=x', 'null')).toBe('');
  });

  it('refuses an empty or missing origin rather than returning a half link', () => {
    expect(resolveShareLink('/s/invoice?token=x', '')).toBe('');
    expect(resolveShareLink('/s/invoice?token=x', undefined)).toBe('');
  });

  it('joins a real origin to a relative url', () => {
    expect(resolveShareLink('/s/invoice?token=x', 'http://localhost:2020/')).toBe(
      'http://localhost:2020/s/invoice?token=x',
    );
  });

  it('gives nothing when there is no url', () => {
    expect(resolveShareLink(undefined, 'http://localhost:2020')).toBe('');
  });
});

describe('billToSnapshotFromCompany', () => {
  it('joins the parts of an address in postal order', () => {
    expect(
      billToSnapshotFromCompany({
        name: 'Sri Murni Sdn Bhd',
        address: {
          addressStreet1: 'No 8, Jalan SS15/4B',
          addressPostcode: '47500',
          addressCity: 'Subang Jaya',
          addressState: 'Selangor',
          addressCountry: 'Malaysia',
        },
      }),
    ).toEqual({
      companyName: 'Sri Murni Sdn Bhd',
      address: 'No 8, Jalan SS15/4B, 47500 Subang Jaya, Selangor, Malaysia',
    });
  });

  it('survives a company with nothing filled in', () => {
    expect(billToSnapshotFromCompany(null)).toEqual({ companyName: '', address: '' });
  });

  it('knows when there is nobody to bill', () => {
    expect(isBillToEmpty(billToSnapshotFromCompany(null))).toBe(true);
    expect(isBillToEmpty(billToSnapshotFromCompany({ name: 'Acme' }))).toBe(false);
  });
});
