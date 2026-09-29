import { defineFrontComponent } from 'twenty-sdk/define';
import { useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';

import {
  APP_DISPLAY_NAME,
  MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

/**
 * The app's front door.
 *
 * Quotes, invoices, projects and milestones have no sidebar entry - Twenty only
 * lists objects it was told to list, and adding six more would bury Companies
 * and People. So the links live here, which is also the only page that can say
 * anything useful about the state of the workspace.
 *
 * The banner is the point of the page. Issuer details are frozen onto every
 * document at the moment it is issued, so a blank or placeholder address is not
 * a cosmetic problem to fix later - it is permanent on everything sent before
 * someone notices.
 */

type Settings = {
  nextDocumentNumberPreview?: string;
  invoicePrefix: string;
  invoicePadding: number;
  nextInvoiceSequence: number;
  paymentInstructions: string;
  publicBaseUrl: string;
  issuer: {
    name: string;
    registrationNo: string;
    address: string;
    email: string;
    phone: string;
  };
};

/**
 * Theme-agnostic on purpose.
 *
 * A front component renders inside whichever theme the workspace member chose,
 * and there is no prop telling us which. So body text inherits its colour from
 * the host instead of naming one, and every surface, border and dimmed label is
 * a translucent grey that darkens a light background and lightens a dark one.
 * Naming '#15181c' here is how this page came out with an invisible heading on
 * a dark workspace.
 */
const COLORS = {
  line: 'rgba(127, 135, 145, 0.28)',
  lineStrong: 'rgba(127, 135, 145, 0.5)',
  surface: 'rgba(127, 135, 145, 0.06)',
  accent: '#1f9d91',
  warnGround: 'rgba(214, 158, 46, 0.14)',
  warnLine: 'rgba(214, 158, 46, 0.45)',
};

/** Dimmed text, both themes: same hue as the host, less of it. */
const muted: React.CSSProperties = { color: 'inherit', opacity: 0.62 };

const DESTINATIONS = [
  {
    label: 'Quotations',
    href: '/objects/quotes',
    hint: 'Everything drafted, issued, accepted or withdrawn',
  },
  {
    label: 'Invoices',
    href: '/objects/invoices',
    hint: 'Drafts waiting to be issued, and what is still unpaid',
  },
  {
    label: 'Projects',
    href: '/objects/projects',
    hint: 'Delivery for the deals that were won',
  },
  {
    label: 'Milestones',
    href: '/objects/milestones',
    hint: 'The billable pieces of each project',
  },
  {
    label: 'Catalogue',
    href: '/objects/products',
    hint: 'What the quotation picker offers, and at what price',
  },
  {
    label: 'Deals',
    href: '/objects/opportunities',
    hint: 'A quotation hangs off a deal - that is where the client comes from',
  },
] as const;

const FLOW = [
  'Open a deal, make a quotation against it',
  'Add items from the catalogue, then Issue',
  'Send the client link - they accept it themselves',
  'Start project: the accepted lines become milestones',
  'Bill a milestone, Issue the invoice, send its link',
  'Mark invoice paid when the money lands',
] as const;

/** Blank, or still carrying the words we seed test workspaces with. */
const looksUnset = (settings: Settings | null) => {
  if (!settings) return false;

  const issuer = settings.issuer ?? ({} as Settings['issuer']);
  const missing =
    !String(issuer.name ?? '').trim() || !String(issuer.address ?? '').trim();
  const placeholder = /test data/i.test(
    `${issuer.name ?? ''} ${issuer.address ?? ''} ${
      settings.paymentInstructions ?? ''
    }`,
  );

  return missing || placeholder;
};

const nextInvoiceNumber = (settings: Settings) =>
  `${settings.invoicePrefix ?? 'INV-'}${String(
    settings.nextInvoiceSequence ?? 1,
  ).padStart(Number(settings.invoicePadding ?? 4), '0')}`;

const Chip = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      padding: '10px 14px',
      border: `1px solid ${COLORS.line}`,
      borderRadius: '8px',
      background: COLORS.surface,
      minWidth: '150px',
    }}
  >
    <span style={{ fontSize: '11.5px', ...muted }}>{label}</span>
    <span
      style={{
        fontSize: '15px',
        fontWeight: 600,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      {value}
    </span>
  </div>
);

const DestinationCard = ({
  label,
  href,
  hint,
}: {
  label: string;
  href: string;
  hint: string;
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        padding: '12px 14px',
        border: `1px solid ${hovered ? COLORS.accent : COLORS.line}`,
        borderRadius: '8px',
        background: COLORS.surface,
        textDecoration: 'none',
        transition: 'border-color 0.15s',
      }}
    >
      <span
        style={{
          fontSize: '13.5px',
          fontWeight: 600,
          color: hovered ? COLORS.accent : 'inherit',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: '11.5px', lineHeight: 1.45, ...muted }}>
        {hint}
      </span>
    </a>
  );
};

const MainPage = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    new RestApiClient()
      .get<Settings>('/s/quote-settings')
      .then(setSettings)
      .catch((error) =>
        setLoadError(
          error instanceof Error ? error.message : 'Could not load settings',
        ),
      );
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '28px 32px 40px',
        maxWidth: '860px',
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '19px', fontWeight: 600 }}>
          {APP_DISPLAY_NAME}
        </span>
        <span style={{ fontSize: '13px', lineHeight: 1.5, ...muted }}>
          Quotations, invoices and delivery, in one place. Nothing here is sent
          to a client until you issue it.
        </span>
      </div>

      {looksUnset(settings) && (
        <div
          style={{
            padding: '12px 14px',
            border: `1px solid ${COLORS.warnLine}`,
            borderRadius: '8px',
            background: COLORS.warnGround,
            fontSize: '12.5px',
            lineHeight: 1.5,
          }}
        >
          <strong>Your business details are not set yet.</strong> They are copied
          onto every quotation and invoice the moment it is issued, and stay
          there. Fill them in on the <strong>Billing</strong> tab before sending
          anything to a real client.
        </div>
      )}

      {loadError && (
        <div
          style={{
            padding: '12px 14px',
            border: `1px solid ${COLORS.line}`,
            borderRadius: '8px',
            background: COLORS.surface,
            fontSize: '12.5px',
            ...muted,
          }}
        >
          Could not read the billing settings: {loadError}
        </div>
      )}

      {settings && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Chip
            label="Next quotation"
            value={settings.nextDocumentNumberPreview ?? '-'}
          />
          <Chip label="Next invoice" value={nextInvoiceNumber(settings)} />
          <Chip
            label="Client links open at"
            value={
              String(settings.publicBaseUrl ?? '').replace(/^https?:\/\//, '') ||
              'not set'
            }
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', ...muted }}>
          GO TO
        </span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '10px',
          }}
        >
          {DESTINATIONS.map((destination) => (
            <DestinationCard key={destination.href} {...destination} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', ...muted }}>
          HOW A JOB RUNS
        </span>
        <ol
          style={{
            margin: 0,
            paddingLeft: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            fontSize: '12.5px',
            lineHeight: 1.5,
          }}
        >
          {FLOW.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <span style={{ fontSize: '11.5px', lineHeight: 1.5, ...muted }}>
          Every action lives on the grey bar at the top of a record. Less common
          ones - withdraw, revise, mark paid - are under the three dots at its
          right end.
        </span>
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: APP_DISPLAY_NAME,
  description: `${APP_DISPLAY_NAME} overview: where to go, what is unset, and how a job runs`,
  component: MainPage,
});
