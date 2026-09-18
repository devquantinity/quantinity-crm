import { defineFrontComponent } from 'twenty-sdk/define';
import { useEffect, useMemo, useState } from 'react';
import { useSelectedRecordIds } from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { CONTACT_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/messaging-identifiers';
import { commandErrorMessage } from 'src/lib/command-error';
import {
  describeWindow,
  groupMessagesByDay,
  dayLabel,
  timeLabel,
  type DeliveryStatus,
  type ServiceWindow,
} from 'src/lib/messaging';

/**
 * Message this contact, without leaving their record.
 *
 * Opening this finds the conversation for their number or starts one, then
 * shows the same thread the Inbox does. Writing to a client should not mean
 * remembering their number, switching tabs and searching for them - that is
 * the friction that sends people back to WhatsApp on their phone, where the
 * conversation then lives only there.
 *
 * Deliberately no conversation list: the record already said who this is.
 */

type Message = {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body?: string | null;
  sentAt?: string | null;
  deliveryStatus?: DeliveryStatus | null;
  deliveryDetail?: string | null;
};

type Opened = {
  conversationId: string | null;
  title: string;
  handle: string;
  created: boolean;
  window: ServiceWindow;
};

const C = {
  ink: '#15181C',
  muted: '#6B747F',
  faint: '#8E97A2',
  line: '#E0E4E8',
  accent: '#0C6E66',
  surface: '#FFFFFF',
  ground: '#F6F7F8',
  mine: '#DCF8C6',
  warn: '#B4541A',
  warnTint: '#FDF3EC',
  danger: '#B3261E',
};

const tickFor = (status?: DeliveryStatus | null) => {
  if (status === 'READ') return '✓✓';
  if (status === 'DELIVERED') return '✓✓';
  if (status === 'SENT') return '✓';
  if (status === 'FAILED') return '⚠';
  if (status === 'QUEUED') return '○';
  return '';
};

const ContactChat = () => {
  const [recordId] = useSelectedRecordIds();
  const [opened, setOpened] = useState<Opened | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!recordId) return;

    const client = new RestApiClient();

    // The record could be a contact or a deal. Try it as a contact first and
    // fall back, rather than asking the panel to know which page it is on.
    client
      .post<Opened>('/s/conversations/for-record', { personId: recordId })
      .catch(() =>
        client.post<Opened>('/s/conversations/for-record', { opportunityId: recordId }),
      )
      .then((result) => {
        setOpened(result);
        setError('');

        if (!result.conversationId) return null;

        return client
          .get<{ messages: Message[] }>(
            `/s/messages?conversationId=${encodeURIComponent(result.conversationId)}`,
          )
          .then((thread) => setMessages(thread.messages ?? []));
      })
      .catch((problem) => setError(commandErrorMessage(problem, 'Could not open a chat')));
  }, [recordId]);

  const items = useMemo(() => {
    const flat: Array<
      { kind: 'day'; key: string; at: string | null } | { kind: 'message'; key: string; message: Message }
    > = [];

    groupMessagesByDay(messages).forEach((group) => {
      flat.push({ kind: 'day', key: `day-${group.key}`, at: group.messages[0]?.sentAt ?? null });
      group.messages.forEach((message) => flat.push({ kind: 'message', key: message.id, message }));
    });

    return flat.reverse();
  }, [messages]);

  const send = async () => {
    const body = draft.trim();

    if (!body || !opened?.conversationId || busy) return;

    setBusy(true);
    setNote('');

    try {
      const result = await new RestApiClient().post<{
        messageId: string | null;
        sentAt: string;
        deliveryStatus: DeliveryStatus;
        deliveryDetail: string;
      }>('/s/messages/send', { conversationId: opened.conversationId, body });

      setDraft('');
      setNote(result.deliveryDetail ?? '');
      setMessages((current) => [
        ...current,
        {
          id: result.messageId ?? `pending-${result.sentAt}`,
          direction: 'OUTBOUND',
          body,
          sentAt: result.sentAt,
          deliveryStatus: result.deliveryStatus,
          deliveryDetail: result.deliveryDetail,
        },
      ]);
    } catch (problem) {
      setNote(commandErrorMessage(problem, 'Could not send that message'));
    } finally {
      setBusy(false);
    }
  };

  const shell: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    background: C.surface,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  if (error) {
    return (
      <div style={{ ...shell, padding: '18px', color: C.danger, fontSize: '13px', lineHeight: 1.6 }}>
        {error}
      </div>
    );
  }

  if (!opened) {
    return (
      <div style={{ ...shell, padding: '18px', color: C.muted, fontSize: '13px' }}>
        Opening&hellip;
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: C.ink }}>{opened.title}</div>
        <div style={{ fontSize: '11.5px', color: C.muted }}>
          {opened.handle}
          {opened.created ? ' · new conversation' : ''}
        </div>
      </div>

      {!opened.window.isOpen && (
        <div
          style={{
            padding: '8px 14px',
            background: C.warnTint,
            borderBottom: `1px solid ${C.line}`,
            color: C.warn,
            fontSize: '11.5px',
            lineHeight: 1.5,
            flexShrink: 0,
          }}
        >
          {opened.window.reason}
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '14px',
          background: C.ground,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: '6px',
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: C.muted, fontSize: '12.5px' }}>
            Nothing yet. Whatever you write here is logged against this record.
          </div>
        )}

        {items.map((item) =>
          item.kind === 'day' ? (
            <div
              key={item.key}
              style={{
                alignSelf: 'center',
                fontSize: '10.5px',
                color: C.muted,
                background: C.surface,
                border: `1px solid ${C.line}`,
                borderRadius: '10px',
                padding: '1px 8px',
                margin: '4px 0',
              }}
            >
              {dayLabel(item.at)}
            </div>
          ) : (
            <div
              key={item.key}
              title={item.message.deliveryDetail ?? ''}
              style={{
                alignSelf: item.message.direction === 'OUTBOUND' ? 'flex-end' : 'flex-start',
                maxWidth: '86%',
                background: item.message.direction === 'OUTBOUND' ? C.mine : C.surface,
                border: `1px solid ${C.line}`,
                borderRadius: '9px',
                padding: '7px 10px',
                fontSize: '12.5px',
                lineHeight: 1.45,
                color: C.ink,
                whiteSpace: 'pre-wrap',
              }}
            >
              <div>{item.message.body}</div>
              <div
                style={{
                  textAlign: 'right',
                  marginTop: '2px',
                  fontSize: '10px',
                  color: item.message.deliveryStatus === 'FAILED' ? C.danger : C.faint,
                }}
              >
                {timeLabel(item.message.sentAt)}{' '}
                {item.message.direction === 'OUTBOUND' && tickFor(item.message.deliveryStatus)}
              </div>
            </div>
          ),
        )}
      </div>

      {note && (
        <div
          style={{
            padding: '6px 14px',
            fontSize: '11.5px',
            color: C.muted,
            background: C.ground,
            borderTop: `1px solid ${C.line}`,
            flexShrink: 0,
            lineHeight: 1.5,
          }}
        >
          {note}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          padding: '10px 12px',
          borderTop: `1px solid ${C.line}`,
          flexShrink: 0,
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) void send();
          }}
          placeholder="Write a message"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '8px 10px',
            borderRadius: '6px',
            border: `1px solid ${C.line}`,
            fontSize: '12.5px',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || draft.trim().length === 0}
          style={{
            background: busy || draft.trim().length === 0 ? '#9FB3B0' : C.accent,
            color: C.surface,
            border: 0,
            borderRadius: '6px',
            padding: '8px 14px',
            fontSize: '12.5px',
            cursor: busy || draft.trim().length === 0 ? 'default' : 'pointer',
            flexShrink: 0,
          }}
        >
          {busy ? '…' : 'Send'}
        </button>
      </div>

      <div style={{ padding: '0 14px 10px', fontSize: '10.5px', color: C.faint, flexShrink: 0 }}>
        {describeWindow(opened.window)}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: CONTACT_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'contact-chat',
  description: 'Message a contact or a deal on WhatsApp from their record',
  component: ContactChat,
});
