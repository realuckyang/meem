import { useEffect, useState } from 'react';
import type { Auth, Item } from './lib/types';
import { vClearToken, vGetToken, vSetToken } from './lib/visitor';
import { pageX } from './lib/ui';
import Header from './components/Header';
import Concierge from './components/Concierge';
import Dynamics from './components/Dynamics';
import Articles from './components/Articles';
import Projects from './components/Projects';
import About from './components/About';
import Contact from './components/Contact';
import ArticleModal from './components/ArticleModal';
import AuthModal from './components/AuthModal';

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [article, setArticle] = useState<Item | null>(null);

  useEffect(() => { fetch('/site/api/content').then((r) => r.json()).then((d) => setItems(d.items || [])).catch(() => {}); }, []);
  useEffect(() => {
    const t = vGetToken();
    if (!t) return;
    fetch('/site/api/visitor/me', { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.profile) setAuth({ token: t, profile: d.profile }); else vClearToken(); })
      .catch(() => {});
  }, []);

  const by = (k: Item['kind']) => items.filter((i) => i.kind === k);
  const about = items.find((i) => i.kind === 'about');
  function onAuthed(a: Auth) { vSetToken(a.token); setAuth(a); setAuthOpen(false); }
  function logout() { vClearToken(); setAuth(null); }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="neon-field" aria-hidden />
      <main className="relative z-[1] min-h-screen bg-transparent">
        <Header auth={auth} onLogin={() => setAuthOpen(true)} onLogout={logout} />
        <Concierge auth={auth} onNeedLogin={() => setAuthOpen(true)} />
        <Dynamics items={by('dynamic')} />
        <Articles items={by('article')} onOpen={setArticle} />
        <Projects items={by('project')} />
        <About item={about} />
        <Contact />
        <footer className={`${pageX} flex justify-between gap-5 pb-10 pt-6 text-sm text-muted-foreground`}>
          <span>Powered by Meem</span>
        </footer>
      </main>
      <div className="neon-scan" aria-hidden />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthed={onAuthed} />}
      {article && <ArticleModal item={article} onClose={() => setArticle(null)} />}
    </div>
  );
}
