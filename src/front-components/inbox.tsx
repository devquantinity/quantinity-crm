import { defineFrontComponent } from 'twenty-sdk/define';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { INBOX_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { commandErrorMessage } from 'src/lib/command-error';
import {
  describeWindow,
  groupMessagesByDay,
  dayLabel,
  timeLabel,
  unreadTotal,
  type ConversationStatus,
  type DeliveryStatus,
  type ServiceWindow,
} from 'src/lib/messaging';

/**
 * The inbox, on real records.
 *
 * This started as SPIKE B - can a front component carry a full-page, two-pane,
 * independently scrolling surface, or is it only good for a dashboard widget?
 * It can, so the layout survived intact and the mock arrays were replaced with
 * three routes. The component runs in a sandboxed worker with no access to the
 * core API, so everything it knows arrives over /s/.
 *
 * It tells the truth about sending. Until a WhatsApp number is connected, a
 * sent message is saved and marked Queued with the reason attached, and the
 * composer says so. A green tick on a message that never left would be the
 * single most damaging lie this screen could tell.
 */

type Row = {
  id: string;
  title: string;
  handle: string;
  companyName: string;
  preview: string;
  status: ConversationStatus;
  unreadCount: number;
  lastMessageAt: string | null;
  opportunityName: string;
  window: ServiceWindow;
};

type ChatMessage = {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body?: string | null;
  sentAt?: string | null;
  deliveryStatus?: DeliveryStatus | null;
  deliveryDetail?: string | null;
};

type Thread = {
  conversationId: string;
  handle: string;
  window: ServiceWindow;
  messages: ChatMessage[];
};

const C = {
  ink: '#15181C',
  muted: '#6B747F',
  faint: '#8E97A2',
  line: '#E0E4E8',
  hair: '#F0F2F4',
  accent: '#0C6E66',
  tint: '#F2F8F7',
  surface: '#FFFFFF',
  ground: '#F6F7F8',
  mine: '#DCF8C6',
  warn: '#B4541A',
  warnTint: '#FDF3EC',
  danger: '#B3261E',
};

const Ticks = ({ status }: { status?: DeliveryStatus | null }) => {
  if (!status || status === 'RECEIVED') return null;

  if (status === 'QUEUED') {
    return (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="4.6" stroke={C.faint} strokeWidth="1.1" />
        <path d="M6 3.6V6.2L7.7 7.2" stroke={C.faint} strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    );
  }

  if (status === 'FAILED') {
    return (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="4.6" stroke={C.danger} strokeWidth="1.1" />
        <path d="M6 3.7V6.6M6 8.2V8.4" stroke={C.danger} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }

  const color = status === 'READ' ? '#34B7F1' : C.faint;
  const double = status === 'DELIVERED' || status === 'READ';

  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
      <path d="M1 5.8L3.6 8.4L8.6 2.6" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      {double && (
        <path d="M6.6 5.8L9.2 8.4L14.2 2.6" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
};

const Centred = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px',
      textAlign: 'center',
      color: C.muted,
      fontSize: '13px',
      lineHeight: 1.6,
    }}
  >
    <div style={{ maxWidth: '360px' }}>{children}</div>
  </div>
);

const Inbox = () => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [listError, setListError] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [threadError, setThreadError] = useState('');
  const [threadLoading, setThreadLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState('');
  const bottom = useRef<HTMLDivElement | null>(null);

  const loadList = useCallback(
    () =>
      new RestApiClient()
        .get<{ conversations: Row[] }>('/s/conversations')
        .then((payload) => {
          setRows(payload.conversations ?? []);
          setListError('');
        })
        .catch((error) => {
          setRows([]);
          setListError(commandErrorMessage(error, 'Could not load the inbox'));
        }),
    [],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!activeId) return;

    setThreadLoading(true);
    setThreadError('');
    setSendNote('');

    new RestApiClient()
      .get<Thread>(`/s/messages?conversationId=${encodeURIComponent(activeId)}`)
      .then((payload) => setThread(payload))
      .catch((error) => {
        setThread(null);
        setThreadError(commandErrorMessage(error, 'Could not open that conversation'));
      })
      .finally(() => setThreadLoading(false));

    // Opening a thread reads it, so drop the badge here too rather than
    // waiting for the next list refresh to tell us what we already did.
    setRows((current) =>
      (current ?? []).map((row) =>
        row.id === activeId ? { ...row, unreadCount: 0 } : row,
      ),
    );
  }, [activeId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [thread]);

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = rows ?? [];

    if (needle.length === 0) return all;

    return all.filter((row) =>
      [row.title, row.companyName, row.handle, row.preview, row.opportunityName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [rows, search]);

  const active = useMemo(
    () => (rows ?? []).find((row) => row.id === activeId) ?? null,
    [rows, activeId],
  );

  const window_ = thread?.window ?? active?.window ?? null;
  const groups = useMemo(
    () => groupMessagesByDay(thread?.messages ?? []),
    [thread],
  );

  const send = async () => {
    const body = draft.trim();

    if (body.length === 0 || !activeId || sending) return;

    setSending(true);
    setSendNote('');

    try {
      const result = await new RestApiClient().post<{
        messageId: string | null;
        sentAt: string;
        deliveryStatus: DeliveryStatus;
        deliveryDetail: string;
      }>('/s/messages/send', { conversationId: activeId, body });

      setDraft('');
      setSendNote(result.deliveryDetail ?? '');
      setThread((current) =>
        current
          ? {
              ...current,
              messages: [
                ...current.messages,
                {
                  id: result.messageId ?? `pending-${result.sentAt}`,
                  direction: 'OUTBOUND',
                  body,
                  sentAt: result.sentAt,
                  deliveryStatus: result.deliveryStatus,
                  deliveryDetail: result.deliveryDetail,
                },
              ],
            }
          : current,
      );
      setRows((current) =>
        (current ?? []).map((row) =>
          row.id === activeId
            ? { ...row, preview: body, lastMessageAt: result.sentAt }
            : row,
        ),
      );
    } catch (error) {
      setSendNote(commandErrorMessage(error, 'Could not send that message'));
    } finally {
      setSending(false);
    }
  };

  const shell: React.CSSProperties = {
    display: 'flex',
    height: '100%',
    minHeight: 0,
    border: `1px solid ${C.line}`,
    borderRadius: '8px',
    overflow: 'hidden',
    background: C.surface,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  if (rows === null) {
    return (
      <div style={shell}>
        <Centred>Loading the inbox&hellip;</Centred>
      </div>
    );
  }

  const unread = unreadTotal(rows);

  return (
    <div style={shell}>
      {/* ---- left pane: conversation list, scrolls on its own ---- */}
      <div
        style={{
          width: '288px',
          flexShrink: 0,
          borderRight: `1px solid ${C.line}`,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, number or deal"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '7px 10px',
              borderRadius: '6px',
              border: `1px solid ${C.line}`,
              fontSize: '12.5px',
              outline: 'none',
            }}
          />
          <div
            style={{
              marginTop: '8px',
              fontSize: '11px',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: C.muted,
            }}
          >
            {matches.length} {matches.length === 1 ? 'conversation' : 'conversations'}
            {unread > 0 ? ` · ${unread} unread` : ''}
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {matches.length === 0 && (
            <div style={{ padding: '18px 14px', fontSize: '12.5px', color: C.muted, lineHeight: 1.6 }}>
              {listError
                ? listError
                : rows.length === 0
                  ? 'No conversations yet. One appears the first time a message is recorded against a number.'
                  : 'Nothing matches that search.'}
            </div>
          )}

          {matches.map((row) => {
            const isActive = row.id === activeId;

            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setActiveId(row.id)}
                style={{
                  display: 'flex',
                  gap: '10px',
                  width: '100%',
                  textAlign: 'left',
                  padding: '11px 14px',
                  border: 0,
                  borderBottom: `1px solid ${C.hair}`,
                  background: isActive ? C.tint : 'transparent',
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
                    background: isActive ? C.accent : '#D5DBE1',
                    color: C.surface,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {(row.title || '?').charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: C.ink,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.title}
                    </span>
                    <span style={{ fontSize: '11px', color: C.faint, flexShrink: 0 }}>
                      {timeLabel(row.lastMessageAt)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: C.muted,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.preview || row.companyName || row.handle}
                  </div>
                </div>

                {row.unreadCount > 0 && (
                  <span
                    style={{
                      background: C.accent,
                      color: C.surface,
                      borderRadius: '10px',
                      fontSize: '11px',
                      padding: '1px 6px',
                      flexShrink: 0,
                      alignSelf: 'center',
                    }}
                  >
                    {row.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- right pane: thread, scrolls on its own, composer pinned ---- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        {!active && (
          <Centred>
            {rows.length === 0 ? (
              <>
                <div style={{ fontWeight: 600, color: C.ink, marginBottom: '6px' }}>
                  Nothing here yet
                </div>
                Conversations and messages are real records now. Nothing will arrive on its own
                until a WhatsApp number is connected &mdash; that is the next piece.
              </>
            ) : (
              'Pick a conversation on the left.'
            )}
          </Centred>
        )}

        {active && (
          <>
            <div style={{ padding: '10px 18px', borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: C.ink }}>{active.title}</div>
              <div style={{ fontSize: '12px', color: C.muted }}>
                {[active.companyName, active.handle, active.opportunityName]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>

            {window_ && !window_.isOpen && (
              <div
                style={{
                  padding: '8px 18px',
                  background: C.warnTint,
                  borderBottom: `1px solid ${C.line}`,
                  color: C.warn,
                  fontSize: '12px',
                  lineHeight: 1.5,
                  flexShrink: 0,
                }}
              >
                {window_.reason}
              </div>
            )}

            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '18px',
                background: C.ground,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {threadLoading && !thread && (
                <div style={{ color: C.muted, fontSize: '12.5px' }}>Opening&hellip;</div>
              )}

              {threadError && (
                <div style={{ color: C.danger, fontSize: '12.5px' }}>{threadError}</div>
              )}

              {!threadLoading && thread && thread.messages.length === 0 && (
                <div style={{ color: C.muted, fontSize: '12.5px' }}>
                  No messages in this conversation yet.
                </div>
              )}

              {groups.map((group) => (
                <div key={group.key} style={{ display: 'contents' }}>
                  <div
                    style={{
                      alignSelf: 'center',
                      fontSize: '11px',
                      color: C.muted,
                      background: C.surface,
                      border: `1px solid ${C.line}`,
                      borderRadius: '10px',
                      padding: '2px 9px',
                      margin: '6px 0',
                    }}
                  >
                    {dayLabel(group.messages[0]?.sentAt)}
                  </div>

                  {group.messages.map((message) => {
                    const outbound = message.direction === 'OUTBOUND';

                    return (
                      <div
                        key={message.id}
                        title={message.deliveryDetail ?? ''}
                        style={{
                          alignSelf: outbound ? 'flex-end' : 'flex-start',
                          maxWidth: '78%',
                          background: outbound ? C.mine : C.surface,
                          border: `1px solid ${C.line}`,
                          borderRadius: '10px',
                          padding: '8px 11px',
                          fontSize: '13px',
                          lineHeight: 1.45,
                          color: C.ink,
                          whiteSpace: 'pre-wrap',
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
                            color: C.faint,
                          }}
                        >
                          {timeLabel(message.sentAt)}
                          {outbound && <Ticks status={message.deliveryStatus} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div ref={bottom} />
            </div>

            {sendNote && (
              <div
                style={{
                  padding: '7px 18px',
                  fontSize: '12px',
                  color: C.muted,
                  background: C.ground,
                  borderTop: `1px solid ${C.line}`,
                  flexShrink: 0,
                  lineHeight: 1.5,
                }}
              >
                {sendNote}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                padding: '12px 14px',
                borderTop: `1px solid ${C.line}`,
                flexShrink: 0,
                background: C.surface,
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder={`Reply to ${active.title}`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: `1px solid #D5DBE1`,
                  fontSize: '13px',
                  outline: 'none',
                }}
              />

              {window_ && (
                <span style={{ fontSize: '11px', color: C.muted, flexShrink: 0 }}>
                  {describeWindow(window_)}
                </span>
              )}

              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || draft.trim().length === 0}
                style={{
                  background: sending || draft.trim().length === 0 ? '#9FB3B0' : C.accent,
                  color: C.surface,
                  border: 0,
                  borderRadius: '6px',
                  padding: '9px 18px',
                  fontSize: '13px',
                  cursor: sending || draft.trim().length === 0 ? 'default' : 'pointer',
                  flexShrink: 0,
                }}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: INBOX_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'inbox',
  description: 'Two-pane inbox over real Conversation and Message records',
  component: Inbox,
});
