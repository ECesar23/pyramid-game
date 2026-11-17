import { useState } from 'react';
import { socket } from '../socket';

const CARD_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];

export default function Recitation({ state }) {
  const { recitationState, players } = state;
  const [chosen, setChosen] = useState([null, null, null, null]);
  const [submitted, setSubmitted] = useState(false);

  if (!recitationState) return null;

  const {
    currentPlayerName, isMyTurn,
    playerIndex, totalPlayers, results,
  } = recitationState;

  function pick(position, value) {
    setChosen(prev => {
      const next = [...prev];
      next[position] = next[position] === value ? null : value;
      return next;
    });
  }

  function submit() {
    if (chosen.some(v => v === null)) return;
    setSubmitted(true);
    socket.emit('submit_recitation', { values: chosen }, res => {
      if (!res?.ok) setSubmitted(false);
    });
  }

  return (
    <div className="screen">
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem' }}>🎤</div>
        <h2 style={{ marginTop: 8 }}>Récitation finale</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
          Joueur {playerIndex + 1}/{totalPlayers} : <strong>{currentPlayerName}</strong>
        </p>
      </div>

      {/* Previous results */}
      {Object.keys(results).length > 0 && (
        <div className="card-box" style={{ gap: 6, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: 4 }}>Résultats précédents</h3>
          {Object.values(results).map(r => (
            <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span>{r.name}</span>
              <span style={{ color: r.wrong > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {r.wrong} erreur{r.wrong !== 1 ? 's' : ''} → {r.wrong}🍺
              </span>
            </div>
          ))}
        </div>
      )}

      {isMyTurn && !submitted ? (
        <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3>🫵 C&apos;est ton tour !</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Annonce tes 4 cartes dans l&apos;ordre (positions 1 à 4). Chaque erreur = 1 gorgée.
          </p>

          {[0, 1, 2, 3].map(pos => (
            <div key={pos}>
              <label className="label">Position {pos + 1}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CARD_VALUES.map(val => (
                  <button
                    key={val}
                    onClick={() => pick(pos, val)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--r-sm)',
                      background: chosen[pos] === val ? 'var(--accent)' : 'var(--surface-hi)',
                      color: chosen[pos] === val ? '#fff' : 'var(--text)',
                      border: '1px solid var(--border)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      minWidth: 44,
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button
            className="btn btn-primary"
            disabled={chosen.some(v => v === null)}
            onClick={submit}
          >
            Valider ({chosen.filter(Boolean).length}/4 choisies)
          </button>
        </div>
      ) : isMyTurn && submitted ? (
        <div className="card-box" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--success)' }}>✓ Réponse envoyée !</p>
        </div>
      ) : (
        <div className="card-box" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>
            En attente que <strong>{currentPlayerName}</strong> annonce ses cartes…
          </p>
        </div>
      )}
    </div>
  );
}
