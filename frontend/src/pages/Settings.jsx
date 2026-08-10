import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Settings() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setMessage('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 pt-8 sm:px-6">
        <h1 className="mb-6 font-display italic text-3xl text-pearl">Settings</h1>

        <div className="glass-panel mb-6 p-6">
          <p className="text-sm text-mist">Signed in as</p>
          <p className="mt-1 font-medium text-pearl">
            {user?.username} <span className="text-xs capitalize text-mist">· {user?.role}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel space-y-4 p-6">
          <h2 className="font-display italic text-xl text-pearl">Change Password</h2>

          <div>
            <label className="mb-1 block text-sm text-mist">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="glass-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-mist">New Password</label>
            <input
              type="password"
              required
              minLength={4}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="glass-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-mist">Confirm New Password</label>
            <input
              type="password"
              required
              minLength={4}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="glass-input"
            />
          </div>

          {message && <p className="text-sm text-mint">{message}</p>}
          {error && <p className="text-sm text-coral">{error}</p>}

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </main>
    </div>
  );
}
