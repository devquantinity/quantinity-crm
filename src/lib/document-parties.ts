/**
 * Who a document is addressed to.
 *
 * Pure. The lookup itself lives in each logic function, because the path to the
 * company differs (a quote reaches it through its opportunity, an invoice
 * through its project's opportunity) and Twenty will not let that whole chain
 * be walked in one query.
 */

export type CompanyForBillTo = {
  name?: string | null;
  address?: {
    addressStreet1?: string | null;
    addressStreet2?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressPostcode?: string | null;
    addressCountry?: string | null;
  } | null;
} | null;

export type BillToSnapshot = { companyName: string; address: string };

export const billToSnapshotFromCompany = (
  company: CompanyForBillTo,
): BillToSnapshot => {
  const address = company?.address;

  return {
    companyName: company?.name ?? '',
    address: [
      address?.addressStreet1,
      address?.addressStreet2,
      [address?.addressPostcode, address?.addressCity]
        .filter((part) => part && String(part).trim().length > 0)
        .join(' '),
      address?.addressState,
      address?.addressCountry,
    ]
      .filter((part) => part && String(part).trim().length > 0)
      .join(', '),
  };
};

export const isBillToEmpty = (billTo: BillToSnapshot) =>
  billTo.companyName.trim().length === 0;
