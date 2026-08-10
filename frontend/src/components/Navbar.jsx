import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, isAdmin, isKeyUser, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initial = user?.username?.charAt(0)?.toUpperCase() || '?';

  return (
    <header className="gpu-layer sticky top-0 z-40 border-b border-white/[0.06] bg-ink/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-display italic text-xl tracking-wide text-pearl">
          Ayesha<span className="text-mist">...</span>
          <span className="text-lg">💗</span>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-orchid font-semibold text-white shadow-glow transition hover:scale-105"
            aria-label="Profile menu"
          >
            {initial}
          </button>

          {open && (
            <div className="glass-panel-solid animate-fade-in absolute right-0 mt-3 w-56 overflow-hidden p-2">
              <div className="px-3 py-2">
                <p className="truncate font-semibold text-pearl">{user?.username}</p>
                <p className="text-xs capitalize text-mist">{user?.role}</p>
              </div>
              <div className="my-1 h-px bg-white/10" />

              {isAdmin && (
                <button
                  onClick={() => { setOpen(false); navigate('/dashboard'); }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-pearl transition hover:bg-white/[0.07]"
                >
                  📊 Dashboard
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => { setOpen(false); navigate('/users'); }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-pearl transition hover:bg-white/[0.07]"
                >
                  👥 Manage Users
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => { setOpen(false); navigate('/keys'); }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-pearl transition hover:bg-white/[0.07]"
                >
                  🔑 Key Generator
                </button>
              )}
              {!isKeyUser && (
                <button
                  onClick={() => { setOpen(false); navigate('/settings'); }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-pearl transition hover:bg-white/[0.07]"
                >
                  ⚙️ Settings
                </button>
              )}
              <div className="my-1 h-px bg-white/10" />
              <button
                onClick={() => logout()}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-coral transition hover:bg-coral/10"
              >
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
