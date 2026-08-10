import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, login, loginWithKey } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('admin'); // 'admin' | 'key'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'admin') {
        await login(username, password);
      } else {
        await loginWithKey(accessKey);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-rose/25 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-orchid/25 blur-[100px]" />

      <div className="glass-panel animate-fade-up relative w-full max-w-sm p-8 sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="text-5xl">💗</span>
          <h1 className="mt-4 font-display italic text-3xl text-pearl">Ayesha...</h1>
          <p className="mt-2 text-sm text-mist">Your private cloud gallery, always safe, always yours.</p>
        </div>

        <div className="mb-5 flex gap-3">
          <button
            type="button"
            onClick={() => { setMode('admin'); setError(''); }}
            className={`chip flex-1 border ${mode === 'admin' ? 'border-rose bg-rose/15 text-rose' : 'border-white/10 text-mist'}`}
          >
            Admin Login
          </button>
          <button
            type="button"
            onClick={() => { setMode('key'); setError(''); }}
            className={`chip flex-1 border ${mode === 'key' ? 'border-rose bg-rose/15 text-rose' : 'border-white/10 text-mist'}`}
          >
            Access Key
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'admin' ? (
            <>
              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-mist">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="glass-input"
                  placeholder="Enter your username"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-mist">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="glass-input pr-12"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-mist hover:text-pearl"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="accessKey" className="mb-1.5 block text-sm font-medium text-mist">
                Access Key
              </label>
              <input
                id="accessKey"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                required
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                className="glass-input font-mono tracking-wide"
                placeholder="XXXX-XXXX-XXXX-XXXX"
              />
            </div>
          )}

          {error && (
            <p className="animate-fade-in rounded-xl border border-coral/30 bg-coral/10 px-4 py-2.5 text-sm text-coral">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

