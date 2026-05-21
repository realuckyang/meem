import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { req, type FeedPost, type FeedComment } from '../../lib/api';
import { useMe } from '../../lib/me';
import { fmtRelTime } from '../../lib/fmtTime';
import Avatar from '../../components/Avatar';
import PostImages from './Images';

interface DetailResp { post: FeedPost; comments: FeedComment[]; }

export default function FeedPostPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { me } = useMe();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);

  async function load() {
    try {
      const r = await req<DetailResp>(`/api/feed/${id}`);
      setPost(r.post);
      setComments(r.comments);
    } catch {}
  }

  useEffect(() => { load(); }, [id]);

  // 按 parent 分组：顶层 + 每个评论的子回复
  const { tops, children } = useMemo(() => {
    const tops: FeedComment[] = [];
    const children: Record<string, FeedComment[]> = {};
    for (const c of comments) {
      if (c.parent) {
        (children[c.parent] ||= []).push(c);
      } else {
        tops.push(c);
      }
    }
    return { tops, children };
  }, [comments]);

  async function togglePostLike() {
    if (!post) return;
    const r = await req<{ liked: boolean; likes: number }>('/api/feed/like', {
      method: 'POST',
      body: JSON.stringify({ target_kind: 'post', target: post.id }),
    });
    setPost({ ...post, liked: r.liked, likes: r.likes });
  }

  async function toggleCommentLike(c: FeedComment) {
    const r = await req<{ liked: boolean; likes: number }>('/api/feed/like', {
      method: 'POST',
      body: JSON.stringify({ target_kind: 'comment', target: c.id }),
    });
    setComments((arr) => arr.map((x) => x.id === c.id ? { ...x, liked: r.liked, likes: r.likes } : x));
  }

  function startReply(c: FeedComment) {
    setReplyTo(c);
    composer.current?.focus();
  }

  async function send() {
    const t = draft.trim();
    if (!t || !post) return;
    setSubmitting(true);
    try {
      const c = await req<FeedComment>(`/api/feed/${post.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: t, parent: replyTo?.id ?? null }),
      });
      setComments((arr) => [...arr, c]);
      setPost({ ...post, replies: post.replies + 1 });
      setDraft('');
      setReplyTo(null);
    } catch (e: any) {
      alert(e?.message ?? '发送失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePost() {
    if (!post || post.author !== me.handle) return;
    if (!confirm('删除这条广播？')) return;
    await req(`/api/feed/${post.id}`, { method: 'DELETE' });
    navigate('/feed');
  }

  if (!post) {
    return (
      <div className="flex flex-col h-full">
        <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200">
          <button onClick={() => navigate('/feed')} className="text-2xl text-accent px-1">‹</button>
          <span className="text-[17px] font-semibold flex-1">广播</span>
        </header>
        <div className="flex-1 flex items-center justify-center text-neutral-400">加载中…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
        <button onClick={() => navigate('/feed')} className="text-2xl text-accent px-1">‹</button>
        <span className="text-[17px] font-semibold flex-1">广播</span>
        {post.author === me.handle && (
          <button onClick={deletePost} className="text-sm text-red-500 px-2">删除</button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* 帖子主体 */}
        <article className="bg-white px-4 py-4 border-b border-neutral-200">
          <div className="flex items-start gap-3">
            <button onClick={() => navigate(`/contacts/${post.author}`)}>
              <Avatar handle={post.author} size={44} />
            </button>
            <div className="min-w-0 flex-1">
              <button
                onClick={() => navigate(`/contacts/${post.author}`)}
                className="text-[15px] font-semibold text-accent"
              >
                {post.author}
              </button>
              <div className="mt-1 text-[15px] text-neutral-800 whitespace-pre-wrap break-words">{post.body}</div>
              {post.images.length > 0 && <div className="mt-3"><PostImages images={post.images} /></div>}
              <div className="flex items-center gap-4 mt-3 text-[13px] text-neutral-500">
                <span>{fmtRelTime(post.created)}</span>
                <button
                  onClick={togglePostLike}
                  className={`flex items-center gap-1 ${post.liked ? 'text-red-500' : ''}`}
                >
                  {post.liked ? '♥' : '♡'} {post.likes}
                </button>
                <span className="flex items-center gap-1">💬 {post.replies}</span>
              </div>
            </div>
          </div>
        </article>

        {/* 评论区 */}
        <div className="bg-white">
          <div className="px-4 py-3 text-[12px] text-neutral-400 font-semibold">{comments.length} 条评论</div>
          {tops.length === 0 && (
            <div className="px-4 py-8 text-center text-neutral-400 text-sm">还没有评论，第一条由你写</div>
          )}
          {tops.map((c) => (
            <div key={c.id} className="px-4 py-3 border-t border-neutral-100">
              <CommentRow c={c} onLike={toggleCommentLike} onReply={startReply} />
              {(children[c.id] || []).length > 0 && (
                <div className="mt-2 pl-10 space-y-2 border-l border-neutral-100 ml-4">
                  {children[c.id].map((sub) => (
                    <div key={sub.id} className="pt-2">
                      <CommentRow c={sub} onLike={toggleCommentLike} onReply={startReply} sub />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 输入框 */}
      <div className="bg-white border-t border-neutral-200 flex-shrink-0">
        {replyTo && (
          <div className="px-4 pt-2 text-[11px] text-neutral-400 flex items-center gap-2">
            <span>回复 @{replyTo.author}</span>
            <button onClick={() => setReplyTo(null)} className="text-accent">取消</button>
          </div>
        )}
        <div className="flex items-end gap-2 px-3 py-2">
          <textarea
            ref={composer}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            placeholder={replyTo ? `回复 @${replyTo.author}…` : '说点什么…'}
            className="flex-1 resize-none px-3 py-2 text-[14px] bg-neutral-100 rounded-lg max-h-24 focus:outline-none"
          />
          <button
            onClick={send}
            disabled={submitting || !draft.trim()}
            className="h-9 px-4 bg-accent text-white rounded-lg text-sm disabled:opacity-40"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentRow({
  c, onLike, onReply, sub,
}: {
  c: FeedComment;
  onLike: (c: FeedComment) => void;
  onReply: (c: FeedComment) => void;
  sub?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex items-start gap-2.5">
      <button onClick={() => navigate(`/contacts/${c.author}`)} className="flex-shrink-0">
        <Avatar handle={c.author} size={sub ? 24 : 32} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium text-neutral-700">{c.author}</div>
        <div className="text-[14px] text-neutral-800 whitespace-pre-wrap break-words mt-0.5">{c.body}</div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-neutral-400">
          <span>{fmtRelTime(c.created)}</span>
          <button onClick={() => onLike(c)} className={c.liked ? 'text-red-500' : ''}>
            {c.liked ? '♥' : '♡'} {c.likes || ''}
          </button>
          <button onClick={() => onReply(c)}>回复</button>
        </div>
      </div>
    </div>
  );
}
