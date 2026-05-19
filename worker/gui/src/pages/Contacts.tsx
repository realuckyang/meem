import { useEffect, useMemo, useState } from 'react';
import { req, type Contact, type DomainUser } from '../api';
import Avatar from '../components/Avatar';
import { pushToast } from '../components/Toast';
import { fmtTime } from '../lib/time';
import { navigate, PATH, type Route } from '../lib/router';

type ContactDraft = { id?: string; name: string; address: string; note: string };

export default function Contacts({ route }: { route: Route }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<DomainUser[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ContactDraft | null>(null);
  const [confirm, setConfirm] = useState<Contact | null>(null);
  const [busy, setBusy] = useState(false);

  // 当前打开的详情来自 URL
  const openContact = route.overlay === 'contactDetail'
    ? contacts.find((c) => c.id === route.contactId) || null
    : null;
  const openUser = route.overlay === 'domainUser'
    ? users.find((u) => u.handle === route.handle) || null
    : null;

  // editor 状态：路由触发 + 临时表单字段（用 local state 持有 draft）
  useEffect(() => {
    if (route.overlay === 'contactNew') {
      setEditing({ name: '', address: '', note: '' });
    } else if (route.overlay === 'contactEdit') {
      const target = contacts.find((c) => c.id === route.contactId);
      if (target) setEditing({
        id: target.id, name: target.name, address: target.address, note: target.note,
      });
    } else {
      setEditing(null);
    }
  }, [route.overlay, route.contactId, contacts]);

  const refresh = () => Promise.all([
    req<Contact[]>('/api/contacts').then(setContacts),
    req<DomainUser[]>('/api/users').then(setUsers),
  ]).catch(() => {});

  const filteredContacts = useMemo(() => {
    const key = query.trim().toLowerCase();
    if (!key) return contacts;
    return contacts.filter((contact) =>
      contact.name.toLowerCase().includes(key) ||
      contact.address.toLowerCase().includes(key) ||
      contact.note.toLowerCase().includes(key),
    );
  }, [contacts, query]);

  const filteredUsers = useMemo(() => {
    const key = query.trim().toLowerCase();
    if (!key) return users;
    return users.filter((user) =>
      user.name.toLowerCase().includes(key) ||
      user.handle.toLowerCase().includes(key) ||
      user.publicAddress.toLowerCase().includes(key),
    );
  }, [users, query]);

  useEffect(() => {
    refresh();
    const onFrame = (event: Event) => {
      const frame = (event as CustomEvent).detail;
      if (
        frame?.type === 'contact-updated' ||
        frame?.type === 'contact-deleted' ||
        frame?.type === 'conversation-message'
      ) refresh();
    };
    window.addEventListener('meem:frame', onFrame as EventListener);
    return () => window.removeEventListener('meem:frame', onFrame as EventListener);
  }, []);

  async function save() {
    if (!editing || !editing.name.trim() || !editing.address.trim() || busy) return;
    setBusy(true);
    try {
      if (editing.id) {
        await req<Contact>(`/api/contacts/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: editing.name.trim(),
            address: editing.address.trim(),
            note: editing.note.trim(),
          }),
        });
        pushToast('已更新', 'success');
      } else {
        await req<Contact>('/api/contacts', {
          method: 'POST',
          body: JSON.stringify({
            name: editing.name.trim(),
            address: editing.address.trim(),
            note: editing.note.trim(),
          }),
        });
        pushToast('已添加', 'success');
      }
      navigate(PATH.contacts());
      refresh();
    } catch {} finally {
      setBusy(false);
    }
  }

  async function deleteContact(c: Contact) {
    setConfirm(null);
    try {
      await req(`/api/contacts/${c.id}`, { method: 'DELETE' });
      pushToast('已删除', 'success');
      navigate(PATH.contacts());
      refresh();
    } catch {}
  }

  async function copyText(text: string, msg = '已复制') {
    await navigator.clipboard.writeText(text).catch(() => {});
    pushToast(msg, 'success');
  }

  async function openMessage(address: string, contactName: string) {
    if (!address || busy) return;
    setBusy(true);
    try {
      const { conversation } = await req<{ conversation: { id: string } }>('/api/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({ address, contact_name: contactName }),
      });
      navigate(PATH.conversation(conversation.id));
    } catch (err: any) {
      pushToast(err?.message || '无法打开会话', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function addFromDomainUser(user: DomainUser) {
    setBusy(true);
    try {
      await req<Contact>('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name: user.name || user.handle,
          address: user.publicAddress,
          note: `@${user.handle}`,
        }),
      });
      pushToast(`已添加 ${user.name || user.handle}`, 'success');
      refresh();
    } catch {} finally { setBusy(false); }
  }

  async function removeAsContact(user: DomainUser) {
    const target = contacts.find((c) => c.address === user.publicAddress);
    if (!target) return;
    setBusy(true);
    try {
      await req(`/api/contacts/${target.id}`, { method: 'DELETE' });
      pushToast('已移除', 'success');
      refresh();
    } catch {} finally { setBusy(false); }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="h-12 shrink-0 flex items-center px-4 border-b bg-white/85 backdrop-blur font-semibold">
        <span className="flex-1 flex items-center gap-1.5">
          <span className="text-lg leading-none">👥</span>
          <span>联系人</span>
        </span>
        <button
          onClick={() => navigate(PATH.contactNew())}
          className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-700 text-xl font-normal hover:bg-neutral-100"
          title="添加联系人"
        >
          +
        </button>
      </header>
      <div className="p-3 bg-white border-b">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索名字或地址"
          className="w-full border border-neutral-200 rounded-full px-4 py-2 text-sm outline-none focus:border-neutral-400"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 && filteredUsers.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-neutral-100 grid place-items-center text-2xl">👥</div>
            <div className="mt-3 text-sm text-neutral-500">没有匹配的结果</div>
          </div>
        ) : (
          <>
            <SectionTitle title="联系人" />
            {filteredContacts.length === 0 ? (
              <div className="px-4 py-6 text-center text-neutral-400 text-sm bg-white border-b">暂无联系人</div>
            ) : (
              filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => navigate(PATH.contactDetail(contact.id))}
                  className="w-full text-left px-4 py-3 border-b bg-white hover:bg-neutral-50 flex items-center gap-3"
                >
                  <Avatar seed={contact.name} label={contact.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{contact.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                      <span className="text-neutral-500 truncate">{contact.address}</span>
                      <span className="ml-auto text-neutral-400 shrink-0">
                        {contact.last_contact_at ? fmtTime(contact.last_contact_at) : fmtTime(contact.updated_at)}
                      </span>
                    </div>
                    {contact.note && <div className="text-xs text-neutral-400 mt-0.5 truncate">{contact.note}</div>}
                  </div>
                  <span className="text-neutral-300 text-sm shrink-0">›</span>
                </button>
              ))
            )}

            <SectionTitle title="本网域" />
            {filteredUsers.length === 0 ? (
              <div className="px-4 py-6 text-center text-neutral-400 text-sm bg-white border-b">暂无网域用户</div>
            ) : (
              filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => navigate(PATH.domainUser(user.handle))}
                  className="w-full text-left px-4 py-3 border-b bg-white hover:bg-neutral-50 flex items-center gap-3"
                >
                  <Avatar seed={user.handle} label={user.name || user.handle} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium truncate">{user.name || user.handle}</span>
                      <span className="text-xs text-neutral-400 shrink-0">@{user.handle}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500 truncate">{user.publicAddress}</div>
                  </div>
                  <span className="text-neutral-300 text-sm shrink-0">›</span>
                </button>
              ))
            )}
          </>
        )}
      </div>

      {/* 编辑 / 新建 */}
      {editing && (
        <ContactEditor
          draft={editing}
          busy={busy}
          onChange={setEditing}
          onClose={() => {
            // 编辑/新建关闭后回到对应上层（编辑→详情；新建→列表）
            if (editing.id) navigate(PATH.contactDetail(editing.id));
            else navigate(PATH.contacts());
          }}
          onSave={save}
          onDelete={editing.id ? () => {
            const target = contacts.find((c) => c.id === editing.id);
            if (target) setConfirm(target);
          } : undefined}
        />
      )}

      {/* 网域用户详情 */}
      {openUser && !editing && (
        <DomainUserDetail
          user={openUser}
          isContact={contacts.some((c) => c.address === openUser.publicAddress)}
          onClose={() => navigate(PATH.contacts())}
          onAddContact={async () => {
            await addFromDomainUser(openUser);
          }}
          onRemoveContact={async () => {
            await removeAsContact(openUser);
          }}
        />
      )}

      {/* 联系人详情 */}
      {openContact && !editing && (
        <ContactDetail
          contact={openContact}
          onClose={() => navigate(PATH.contacts())}
          onEdit={() => navigate(PATH.contactEdit(openContact.id))}
          onDelete={() => setConfirm(openContact)}
          onCopy={() => copyText(openContact.address, '已复制地址')}
          onMessage={() => openMessage(openContact.address, openContact.name)}
        />
      )}

      {/* 删除确认 */}
      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <button onClick={() => setConfirm(null)}
                  className="absolute inset-0 bg-black/30 meem-fade-enter" />
          <div className="relative mx-3 mb-3 w-full max-w-md rounded-2xl bg-white shadow-xl p-4 meem-sheet-enter">
            <div className="font-semibold text-[15px]">删除联系人「{confirm.name}」？</div>
            <div className="text-sm text-neutral-500 mt-1">联系人会被清掉，与之相关的会话仍保留。</div>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)}
                      className="px-3 py-1.5 rounded-lg text-sm text-neutral-600 hover:bg-neutral-100">取消</button>
              <button onClick={() => deleteContact(confirm)}
                      className="px-3 py-1.5 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="px-4 pt-3 pb-1 bg-neutral-50 text-[11px] text-neutral-400">
      {title}
    </div>
  );
}

function ContactDetail({
  contact, onClose, onEdit, onDelete, onCopy, onMessage,
}: {
  contact: Contact;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onMessage: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-50">
      <header className="h-12 shrink-0 flex items-center px-3 border-b bg-white/85 backdrop-blur">
        <button onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-neutral-700 text-lg">‹</button>
        <div className="flex-1 text-center font-semibold text-[15px] truncate">{contact.name}</div>
        <button onClick={onEdit}
                className="text-sm text-neutral-900 px-1 hover:text-black">编辑</button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex items-center gap-3">
          <Avatar seed={contact.name} label={contact.name} size={48} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{contact.name}</div>
            <button onClick={onCopy}
                    className="text-xs text-neutral-500 truncate underline-offset-2 hover:underline">
              {contact.address}
            </button>
          </div>
        </div>
        {contact.note && (
          <div className="rounded-2xl bg-white border border-neutral-200 p-4 text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap">
            {contact.note}
          </div>
        )}
        <button
          onClick={onMessage}
          className="w-full bg-neutral-900 rounded-xl py-3 text-white font-medium hover:bg-black"
        >
          发消息
        </button>
        <button
          onClick={onDelete}
          className="w-full bg-white border border-neutral-200 rounded-xl py-3 text-red-500 font-medium hover:bg-red-50/40"
        >
          删除
        </button>
      </div>
    </div>
  );
}

function DomainUserDetail({
  user, isContact, onClose, onAddContact, onRemoveContact,
}: {
  user: DomainUser;
  isContact: boolean;
  onClose: () => void;
  onAddContact: () => Promise<void>;
  onRemoveContact: () => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [composing, setComposing] = useState(false);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const { conversation } = await req<{ conversation: { id: string } }>('/api/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          address: user.publicAddress,
          contact_name: user.name || user.handle,
          text: body,
        }),
      });
      pushToast('已送达', 'success');
      setText('');
      setComposing(false);
      navigate(PATH.conversation(conversation.id));
    } catch (err: any) {
      pushToast(err?.message || '发送失败', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-50">
      <header className="h-12 shrink-0 flex items-center px-3 border-b bg-white/85 backdrop-blur">
        <button onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-neutral-700 text-lg">‹</button>
        <div className="flex-1 text-center font-semibold text-[15px] truncate">
          {user.name || user.handle}
        </div>
        <div className="w-7" />
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex items-center gap-3">
          <Avatar seed={user.handle} label={user.name || user.handle} size={48} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{user.name || user.handle}</div>
            <div className="text-xs text-neutral-400 mt-0.5">@{user.handle}</div>
            <div className="text-[11px] text-neutral-400 mt-0.5 truncate">{user.publicAddress}</div>
          </div>
        </div>

        {composing ? (
          <div className="rounded-2xl bg-white border border-neutral-200 p-3 space-y-2">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`写给 ${user.name || user.handle}…`}
              rows={5}
              className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm leading-6 outline-none focus:border-neutral-400 focus:bg-white"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setComposing(false); setText(''); }}
                className="flex-1 rounded-xl border border-neutral-200 bg-white py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                取消
              </button>
              <button
                onClick={send}
                disabled={!text.trim() || sending}
                className="flex-1 rounded-xl bg-neutral-900 py-2 text-sm text-white disabled:bg-neutral-200"
              >
                {sending ? '发送中…' : '发送'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setComposing(true)}
            className="w-full rounded-xl bg-neutral-900 py-2.5 text-sm font-medium text-white"
          >
            发送消息
          </button>
        )}

        {isContact ? (
          <button
            onClick={onRemoveContact}
            className="w-full rounded-xl bg-white border border-neutral-200 py-2.5 text-sm text-red-500 hover:bg-red-50/40"
          >
            移除联系人
          </button>
        ) : (
          <button
            onClick={onAddContact}
            className="w-full rounded-xl bg-white border border-neutral-200 py-2.5 text-sm text-neutral-900 hover:bg-neutral-50"
          >
            加为联系人
          </button>
        )}
      </div>
    </div>
  );
}

function ContactEditor({
  draft, busy, onChange, onClose, onSave, onDelete,
}: {
  draft: ContactDraft;
  busy: boolean;
  onChange: (draft: ContactDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-neutral-50">
      <header className="h-12 shrink-0 flex items-center justify-between px-3 border-b bg-white/85 backdrop-blur">
        <button onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-neutral-600 text-lg">‹</button>
        <div className="font-medium">{draft.id ? '编辑联系人' : '新联系人'}</div>
        <button onClick={onSave}
                disabled={busy || !draft.name.trim() || !draft.address.trim()}
                className="text-sm text-neutral-900 disabled:text-neutral-300 px-1">
          {busy ? '保存中…' : '保存'}
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="名字"
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
        />
        <input
          value={draft.address}
          onChange={(e) => onChange({ ...draft, address: e.target.value })}
          placeholder="Meem 地址或联系方式"
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
        />
        <textarea
          value={draft.note}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
          placeholder="备注（可选）"
          rows={4}
          className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
        />
        {onDelete && (
          <button onClick={onDelete}
                  className="w-full bg-white border border-neutral-200 rounded-xl py-2.5 text-red-500 text-sm hover:bg-red-50/40">
            删除联系人
          </button>
        )}
      </div>
    </div>
  );
}
