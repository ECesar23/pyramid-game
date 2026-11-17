import { useState } from 'react';
import { socket } from '../socket';
import { canStartClient, pyramidCardCountClient } from '../gameUtils';

export default function LobbyRoom({ state, onLeave }) {
  const { code, isHost, settings, players } = state;
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const deckCards = (settings.numDecks ?? 1) * 52;
  const totalCards = players.length * 4 + pyramidCardCountClient(settings.floors);
  const canStart = players.length >= 2 && totalCards <= deckCards;
  const maxFloors = Math.max(2, Math.floor((-1 + Math.sqrt(1 + 8 * (deckCards - players.length * 4))) / 2));

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function updateSetting(key, value) {
    socket.emit('update_settings', { [key]: value });
  }

  function startGame() {
    setError('');
    socket.emit('start_game', null, res => {
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Salon</h2>
        <button className="btn btn-ghost" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }} onClick={onLeave}>
          Quitter
        </button>
      </div>

      {/* Room code */}
      <div className="card-box" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={copyCode}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Code du salon (tapez pour copier)</p>
        <div style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: 10, color: 'var(--accent)' }}>{code}</div>
        {copied && <p style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: 4 }}>Copié !</p>}
      </div>

      {/* Players */}
      <div className="card-box" style={{ gap: 10, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3>Joueurs</h3>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{players.length}/10</span>
        </div>
        {players.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.1rem' }}>{p.id === state.players.find(x => x.isMe)?.id ? '👤' : '👥'}</span>
            <span style={{ fontWeight: p.isMe ? 700 : 400 }}>{p.name}</span>
            {!p.connected && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(déconnecté)</span>}
            {p.id === state.players[0]?.id && <span style={{ color: 'var(--accent)', fontSize: '0.75rem', marginLeft: 'auto' }}>Hôte</span>}
          </div>
        ))}
        {players.length < 2 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            En attente d&apos;au moins un autre joueur…
          </p>
        )}
      </div>

      {/* Settings (host only) */}
      {isHost && (
        <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h3 style={{ marginBottom: 8 }}>Réglages</h3>

          <div className="toggle-row">
            <div>
              <div style={{ fontWeight: 500 }}>Nombre de paquets</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{settings.numDecks ?? 1} paquet{(settings.numDecks ?? 1) > 1 ? 's' : ''} · {(settings.numDecks ?? 1) * 52} cartes disponibles</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn btn-ghost"
                style={{ width: 36, height: 36, padding: 0, fontSize: '1.1rem', borderRadius: '50%' }}
                onClick={() => updateSetting('numDecks', Math.max(1, (settings.numDecks ?? 1) - 1))}
              >−</button>
              <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{settings.numDecks ?? 1}</span>
              <button
                className="btn btn-ghost"
                style={{ width: 36, height: 36, padding: 0, fontSize: '1.1rem', borderRadius: '50%' }}
                onClick={() => updateSetting('numDecks', Math.min(5, (settings.numDecks ?? 1) + 1))}
              >+</button>
            </div>
          </div>

          <div className="toggle-row">
            <div>
              <div style={{ fontWeight: 500 }}>Étages de la pyramide</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{settings.floors} étages · {pyramidCardCountClient(settings.floors)} cartes</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn btn-ghost"
                style={{ width: 36, height: 36, padding: 0, fontSize: '1.1rem', borderRadius: '50%' }}
                onClick={() => updateSetting('floors', Math.max(2, settings.floors - 1))}
              >−</button>
              <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{settings.floors}</span>
              <button
                className="btn btn-ghost"
                style={{ width: 36, height: 36, padding: 0, fontSize: '1.1rem', borderRadius: '50%' }}
                onClick={() => updateSetting('floors', Math.min(maxFloors, settings.floors + 1))}
              >+</button>
            </div>
          </div>

          <div className="toggle-row">
            <div>
              <div style={{ fontWeight: 500 }}>Durée de mémorisation</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{settings.memorizeDuration} secondes</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn btn-ghost"
                style={{ width: 36, height: 36, padding: 0, fontSize: '1.1rem', borderRadius: '50%' }}
                onClick={() => updateSetting('memorizeDuration', Math.max(2, settings.memorizeDuration - 1))}
              >−</button>
              <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{settings.memorizeDuration}</span>
              <button
                className="btn btn-ghost"
                style={{ width: 36, height: 36, padding: 0, fontSize: '1.1rem', borderRadius: '50%' }}
                onClick={() => updateSetting('memorizeDuration', Math.min(10, settings.memorizeDuration + 1))}
              >+</button>
            </div>
          </div>

          <div className="toggle-row">
            <div>
              <div style={{ fontWeight: 500 }}>Remplacer la carte révélée</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Après un défi réussi</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={settings.replaceCard} onChange={e => updateSetting('replaceCard', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <div style={{ fontWeight: 500 }}>Récitation finale</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chaque joueur annonce ses cartes</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={settings.finalRecitation} onChange={e => updateSetting('finalRecitation', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>

          <div style={{ marginTop: 8, padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: totalCards > deckCards ? 'var(--danger)' : 'var(--text-muted)' }}>
            Cartes utilisées : {totalCards}/{deckCards}
            {totalCards > deckCards && ' — trop de joueurs ou d\'étages !'}
          </div>
        </div>
      )}

      {/* Non-host: waiting */}
      {!isHost && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          En attente que l&apos;hôte lance la partie…
        </p>
      )}

      {error && <p className="error-msg">{error}</p>}

      {/* Start button */}
      {isHost && (
        <button
          className="btn btn-primary"
          disabled={!canStart}
          onClick={startGame}
        >
          {canStart ? 'Lancer la partie 🚀' : `Impossible (${totalCards}/52 cartes)`}
        </button>
      )}
    </div>
  );
}
