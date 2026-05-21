import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { req, type Message, type Session as SessionType } from '../../lib/api';
import { onFrame } from '../../lib/socket';
import { useMe } from '../../lib/me';
import { usePresence } from '../../lib/presence';
import Avatar from '../../components/Avatar';
import { AvatarPresence } from '../../components/PresenceDot';
import Composer from '../../components/Composer';
import MessageRow from '../../components/MessageRow';
import MessageAgentBlock from './AgentBlock';

function fmtClock(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function Conversation() {
  const { cid = '' } = useParams();
  const navigate = useNavigate();
  const { me } = useMe();
  const [messages, setMessages] = useState<Message[]>([]);
  const [peer, setPeer] = useState('');
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [agentByMsg, setAgentByMsg] = useState<Record<string, SessionType>>({});
  const peerHandles = useMemo(() => (peer ? [peer] : []), [peer]);
  const presence = usePresence(peerHandles);
  const peerStatus = presence[peer];
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = () =>
    req<Message[]>(`/api/conversations/${cid}/messages`).then((msgs) => {
      setMessages(msgs);
      const other = msgs.find((m) => m.sender !== me.handle)?.sender;
      if (other) setPeer(other);
    }).catch(() => {});

  const loadAgents = () =>
    req<SessionType[]>('/api/sessions?kind=agent').then((list) => {
      const map: Record<string, SessionType> = {};
      for (const s of list) if (s.trigger) map[s.trigger] = s;
      setAgentByMsg(map);
    }).catch(() => {});

  useEffect(() => {
    if (!cid) return;
    load();
    loadAgents();
    const off = onFrame((f: any) => {
      if (f.type === 'message' && f.message?.cid === cid) load();
    });
    return off;
  }, [cid]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(text: string) {
    setSending(true);
    try {
      await req(`/api/conversations/${cid}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      });
      load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
        <button onClick={() => navigate('/messages')} className="text-2xl text-accent px-1 leading-none">‹</button>
        {peer && (
          <div className="relative flex-shrink-0">
            <Avatar handle={peer} size={28} />
            <AvatarPresence status={peerStatus} size={8} />
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-[16px] font-semibold leading-tight truncate">{peer || '会话'}</span>
          {peerStatus?.online && (
            <span className={`text-[11px] leading-tight ${(peerStatus.extension || peerStatus.extensionBg) ? 'text-emerald-600' : 'text-amber-600'}`}>
              {(peerStatus.extension || peerStatus.extensionBg) ? '浏览器在线' : '浏览器离线'}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
        {messages.length === 0 && (
          <div className="py-16 text-center text-neutral-400 text-sm">还没消息，发个招呼吧</div>
        )}
        {(() => {
          // 只在最新一条对方消息下挂悄悄商量入口
          let lastPeerIdx = -1;
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].sender !== me.handle) { lastPeerIdx = i; break; }
          }
          return messages.map((m, i) => {
            const mine = m.sender === me.handle;
            return (
              <div key={m.id} className="bg-white">
                <MessageRow
                  who={mine ? '我' : m.sender}
                  time={fmtClock(m.created)}
                  avatar={<Avatar handle={mine ? me.handle : m.sender} size={28} />}
                >
                  <div className="whitespace-pre-wrap">{m.body}</div>
                </MessageRow>
                {!mine && i === lastPeerIdx && (
                  <MessageAgentBlock
                    messageId={m.id}
                    initialSession={agentByMsg[m.id] ?? null}
                    onAdopt={setDraft}
                  />
                )}
              </div>
            );
          });
        })()}
        <div ref={bottomRef} />
      </div>

      <Composer
        onSend={send}
        disabled={sending}
        value={draft}
        onChange={setDraft}
        placeholder="输入消息…"
      />
    </div>
  );
}
