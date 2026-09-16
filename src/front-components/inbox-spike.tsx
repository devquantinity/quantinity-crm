import { defineFrontComponent } from 'twenty-sdk/define';
import { useState } from 'react';

import { INBOX_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * SPIKE B — the question this answers:
 *
 *   Can a front component carry a full-page, two-pane, independently scrolling
 *   surface, or is it really only good for a fixed-size dashboard widget?
 *
 * A WhatsApp inbox is the hardest shape to fit: a long conversation list beside
 * a long message thread, each scrolling on its own, with a composer pinned to
 * the bottom. If this renders and both panes scroll, WhatsApp can live inside
 * Twenty. If it clips or the panes fight, the inbox moves to a companion app.
 *
 * Watch for: does the component get the tab's full height, do both panes scroll
 * separately, does the composer stay pinned, does the page itself double-scroll.
 */

type Conversation = {
  id: string;
  name: string;
  company: string;
  preview: string;
  time: string;
  unread: number;
};

type Message = {
  id: string;
  direction: 'in' | 'out';
  body: string;
  time: string;
  status?: 'sent' | 'delivered' | 'read';
};

const NAMES: ReadonlyArray<[string, string]> = [
  ['Nurul Huda', 'Acme Trading'],
  ['Lim Wei Jie', 'Pintar Logistics'],
  ['Raj Kumar', 'Sinaran Digital'],
  ['Siti Aminah', 'Rania Enterprise'],
  ['Tan Mei Ling', 'Bayu Construction'],
  ['Farid Rahman', 'Delima Foods'],
  ['Chong Ah Seng', 'Hartanah Prima'],
  ['Aishah Yusof', 'Cempaka Retail'],
  ['Danial Hakim', 'Zenith Media'],
  ['Wong Kah Hoe', 'Orient Supplies'],
  ['Zulkifli Omar', 'Mutiara Tech'],
  ['Preeti Nair', 'Aurora Labs'],
];

const PREVIEWS = [
  'Ok noted, let me check with my team first',
  'Can you send the quotation again? Cannot open',
  'Thanks! Received the invoice already',
  'Is the deposit 50% or 30%?',
  'We want to proceed. What is next step?',
  'Sorry just saw this, was on leave',
];

const CONVERSATIONS: Conversation[] = Array.from({ length: 36 }, (_, index) => {
  const [name, company] = NAMES[index % NAMES.length];
  return {
    id: `c${index}`,
    name: index < NAMES.length ? name : `${name} (${Math.floor(index / NAMES.length) + 1})`,
    company,
    preview: PREVIEWS[index % PREVIEWS.length],
    time: `${String(9 + (index % 9)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}`,
    unread: index % 5 === 0 ? (index % 3) + 1 : 0,
  };
});

const THREAD: Message[] = [
  { id: 'm1', direction: 'in', body: 'Hi, saw your post about the CRM setup. Still available?', time: '09:12' },
  { id: 'm2', direction: 'out', body: 'Hi Nurul, yes we are. Happy to walk you through it.', time: '09:15', status: 'read' },
  { id: 'm3', direction: 'in', body: 'Great. We are 8 people, mostly sales. Currently using Excel and it is getting messy', time: '09:16' },
  { id: 'm4', direction: 'out', body: 'That is a common starting point. The main thing you would gain is quotations and follow-ups in one place instead of scattered files.', time: '09:20', status: 'read' },
  { id: 'm5', direction: 'in', body: 'Can it send quotation to client directly?', time: '09:21' },
  { id: 'm6', direction: 'out', body: 'Yes. You build the quote, issue it, and the client gets a private link. They can accept it online and it updates the deal automatically.', time: '09:24', status: 'read' },
  { id: 'm7', direction: 'in', body: 'Nice. And WhatsApp? Most of our clients only reply on WhatsApp', time: '09:25' },
  { id: 'm8', direction: 'out', body: 'Same thing. Messages to and from your business number get logged against the contact, so nothing lives only on someone phone.', time: '09:28', status: 'delivered' },
  { id: 'm9', direction: 'in', body: 'Ok this is what we need. Can you send quotation?', time: '09:30' },
  { id: 'm10', direction: 'out', body: 'Sending now. Give me two minutes.', time: '09:31', status: 'sent' },
  { id: 'm11', direction: 'in', body: 'Ok noted, let me check with my team first', time: '09:44' },
];

const Ticks = ({ status }: { status?: Message['status'] }) => {
  if (!status) return null;
  const color = status === 'read' ? '#34B7F1' : '#8E97A2';
  const double = status !== 'sent';

  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
      <path d="M1 5.8L3.6 8.4L8.6 2.6" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      {double && (
        <path d="M6.6 5.8L9.2 8.4L14.2 2.6" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
};

const InboxSpike = () => {
  const [activeId, setActiveId] = useState(CONVERSATIONS[0].id);
  const [draft, setDraft] = useState('');

  const active =
    CONVERSATIONS.find((conversation) => conversation.id === activeId) ??
    CONVERSATIONS[0];

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
        border: '1px solid #E0E4E8',
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#FFFFFF',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* ---- left pane: conversation list, scrolls on its own ---- */}
      <div
        style={{
          width: '288px',
          flexShrink: 0,
          borderRight: '1px solid #E0E4E8',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid #E0E4E8',
            fontSize: '11px',
            letterSpacing: '.09em',
            textTransform: 'uppercase',
            color: '#6B747F',
            flexShrink: 0,
          }}
        >
          {CONVERSATIONS.length} conversations
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {CONVERSATIONS.map((conversation) => {
            const isActive = conversation.id === activeId;

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setActiveId(conversation.id)}
                style={{
                  display: 'flex',
                  gap: '10px',
                  width: '100%',
                  textAlign: 'left',
                  padding: '11px 14px',
                  border: 0,
                  borderBottom: '1px solid #F0F2F4',
                  background: isActive ? '#F2F8F7' : 'transparent',
                  cursor: 'pointer',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: isActive ? '#0C6E66' : '#D5DBE1',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {conversation.name.charAt(0)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#15181C',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {conversation.name}
                    </span>
                    <span style={{ fontSize: '11px', color: '#8E97A2', flexShrink: 0 }}>
                      {conversation.time}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#6B747F',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {conversation.preview}
                  </div>
                </div>

                {conversation.unread > 0 && (
                  <span
                    style={{
                      background: '#0C6E66',
                      color: '#FFFFFF',
                      borderRadius: '10px',
                      fontSize: '11px',
                      padding: '1px 6px',
                      flexShrink: 0,
                      alignSelf: 'center',
                    }}
                  >
                    {conversation.unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- right pane: thread, scrolls on its own, composer pinned ---- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid #E0E4E8',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{active.name}</div>
          <div style={{ fontSize: '12px', color: '#6B747F' }}>
            {active.company} · window closes in 23h
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '18px',
            background: '#F6F7F8',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {THREAD.map((message) => {
            const outbound = message.direction === 'out';

            return (
              <div
                key={message.id}
                style={{
                  alignSelf: outbound ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                  background: outbound ? '#DCF8C6' : '#FFFFFF',
                  border: '1px solid #E0E4E8',
                  borderRadius: '10px',
                  padding: '8px 11px',
                  fontSize: '13px',
                  lineHeight: 1.45,
                  color: '#15181C',
                }}
              >
                <div>{message.body}</div>
                <div
                  style={{
                    display: 'flex',
                    gap: '5px',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    marginTop: '3px',
                    fontSize: '10.5px',
                    color: '#8E97A2',
                  }}
                >
                  {message.time}
                  <Ticks status={message.status} />
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 14px',
            borderTop: '1px solid #E0E4E8',
            flexShrink: 0,
            background: '#FFFFFF',
          }}
        >
          <input
            id="inbox-spike-composer"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Reply to ${active.name}`}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '9px 12px',
              borderRadius: '6px',
              border: '1px solid #D5DBE1',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => setDraft('')}
            style={{
              background: '#0C6E66',
              color: '#FFFFFF',
              border: 0,
              borderRadius: '6px',
              padding: '9px 18px',
              fontSize: '13px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: INBOX_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'inbox-spike',
  description:
    'Spike: two-pane WhatsApp-style inbox, to test whether a front component can carry a full-page scrolling surface.',
  component: InboxSpike,
});
