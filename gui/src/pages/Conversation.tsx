import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { req, type Message, type Session as SessionType } from '../lib/api';
import { onFrame } from '../lib/socket';
import { useMe } from '../lib/me';
import Avatar from '../components/Avatar';
import Composer from '../components/Composer';
import MessageRow from '../components/MessageRow';
import MessageAgentBlock from '../components/MessageAgentBlock';

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
        {peer && <Avatar handle={peer} size={28} />}
        <span className="text-[17px] font-semibold">{peer || '会话'}</span>
      </header>

      <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
        {messages.length === 0 && (
          <div className="py-16 text-center text-neutral-400 text-sm">还没消息，发个招呼吧</div>
        )}
        {messages.map((m) => {
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
              {!mine && (
                <MessageAgentBlock
                  messageId={m.id}
                  initialSession={agentByMsg[m.id] ?? null}
                  onAdopt={setDraft}
                />
              )}
            </div>
          );
        })}
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
