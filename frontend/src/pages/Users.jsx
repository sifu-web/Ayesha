import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const emptyForm = { id: null, username: '', password: '', role: 'user' };

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  async function fetchUsers() {
    setLoading(true);
    const { data } = await api.get('/users');
    setUsers(data.users);
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  }

  function openEdit(u) {
    setForm({ id: u.id, username: u.username, password: '', role: u.role });
    setError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (form.id) {
        const payload = { username: form.username, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${form.id}`, payload);
      } else {
        await api.post('/users', { username: form.username, password: form.password, role: form.role });
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    }
  }

  async function handleDelete(u) {
    if (!window.confirm(`Delete user "${u.username}"?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete user.');
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display italic text-3xl text-pearl">Manage Users</h1>
          <button onClick={openCreate} className="btn-primary">＋ New User</button>
        </div>

        <div className="glass-panel divide-y divide-white/[0.06] overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-mist">Loading…</div>
          ) : (
            users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-orchid font-semibold text-white">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-pearl">
                      {u.username} {u.id === me.id && <span className="text-xs text-mist">(you)</span>}
                    </p>
                    <p className="text-xs capitalize text-mist">{u.role}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(u)} className="btn-ghost !px-3 !py-2 text-sm">Edit</button>
                  <button onClick={() => handleDelete(u)} className="btn-danger !px-3 !py-2 text-sm">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {modalOpen && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="glass-panel animate-fade-up w-full max-w-sm p-6">
            <h2 className="mb-4 font-display italic text-2xl text-pearl">{form.id ? 'Edit User' : 'New User'}</h2>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-mist">Username</label>
                <input
                  required
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className="glass-input"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-mist">
                  Password {form.id && <span className="text-xs">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  required={!form.id}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="glass-input"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-mist">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="glass-input cursor-pointer"
                >
                  <option value="user" className="bg-charcoal">User</option>
                  <option value="admin" className="bg-charcoal">Administrator</option>
                </select>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-coral">{error}</p>}

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1">
                {form.id ? 'Save' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
