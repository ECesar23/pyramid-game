import { useState } from 'react';
import { socket } from '../socket';

export default function Lobby({ onJoined }) {
  const [mode, setMode]     = useState(null); // 'create' | 'join'
  const [name, setName]     = useState('');
  const [code, setCode]     = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function handleCreate() {
    if (!name.trim()) return setError('Entre ton pseudo');
    setLoading(true);
    socket.emit('create_room', { name: name.trim() }, res => {
      setLoading(false);
      if (res.error) return setError(res.error);
      onJoined(res.code, name.trim());
    });
  }

  function handleJoin() {
    if (!name.trim()) return setError('Entre ton pseudo');
    if (!code.trim() || code.length !== 4) return setError('Code à 4 lettres');
    setLoading(true);
    socket.emit('join_room', { name: name.trim(), code: code.trim().toUpperCase() }, res => {
      setLoading(false);
      if (res.error) return setError(res.error);
      onJoined(res.code, name.trim());
    });
  }

  if (!mode) {
    return (
      <div className="screen" style={{ justifyContent: 'center', flex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>🃏</div>
          <h1 style={{ marginTop: 12, marginBottom: 4 }}>La Pyramide</h1>
          <p style={{ color: 'var(--text-muted)' }}>Jeu à boire multijoueur</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn btn-primary" onClick={() => setMode('create')}>
            Créer une partie
          </button>
          <button className="btn btn-secondary" onClick={() => setMode('join')}>
            Rejoindre une partie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <button
        className="btn btn-ghost"
        style={{ width: 'auto', alignSelf: 'flex-start', padding: '8px 14px', marginBottom: 4 }}
        onClick={() => { setMode(null); setError(''); }}
      >
        ← Retour
      </button>

      <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2>{mode === 'create' ? '✨ Créer une partie' : '🔑 Rejoindre'}</h2>

        <div>
          <label className="label">Ton pseudo</label>
          <input
            className="text-input"
            placeholder="ex. Léo"
            value={name}
            maxLength={20}
            onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && (mode === 'create' ? handleCreate() : handleJoin())}
            autoFocus
          />
        </div>

        {mode === 'join' && (
          <div>
            <label className="label">Code du salon (4 lettres)</label>
            <input
              className="text-input"
              placeholder="ABCD"
              value={code}
              maxLength={4}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              style={{ letterSpacing: 6, textTransform: 'uppercase', textAlign: 'center', fontSize: '1.4rem' }}
            />
          </div>
        )}

        {error && <p className="error-msg">{error}</p>}

        <button
          className="btn btn-primary"
          disabled={loading}
          onClick={mode === 'create' ? handleCreate : handleJoin}
        >
          {loading ? '…' : mode === 'create' ? 'Créer' : 'Rejoindre'}
        </button>
      </div>
    </div>
  );
}
