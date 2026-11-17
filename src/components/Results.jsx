import { socket } from '../socket';

export default function Results({ state }) {
  const { players, isHost, code } = state;
  const sorted = [...players].sort((a, b) => b.sipsReceived - a.sipsReceived);
  const minSips = Math.min(...players.map(p => p.sipsReceived));

  return (
    <div className="screen">
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>🏆</div>
        <h1 style={{ marginTop: 8 }}>Résultats</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>Salon {code}</p>
      </div>

      <div className="card-box" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="results-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Joueur</th>
              <th>🍺 Bues</th>
              <th>Données</th>
              <th>Bluffs ✓/✗</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.id} className={p.sipsReceived === minSips ? 'winner' : ''}>
                <td>{i + 1}</td>
                <td>
                  {p.name}
                  {p.isMe && <span style={{ color: 'var(--accent2)', marginLeft: 4, fontSize: '0.75rem' }}>toi</span>}
                  {p.sipsReceived === minSips && <span style={{ marginLeft: 4 }}>👑</span>}
                </td>
                <td style={{ fontWeight: 700 }}>{p.sipsReceived}</td>
                <td>{p.sipsGiven}</td>
                <td>{p.challengesWon}/{p.challengesWon + p.challengesLost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card-box">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
          🏆 Moins de gorgées bues = meilleur joueur
        </p>
        <p style={{ color: 'var(--success)', fontWeight: 700, textAlign: 'center', marginTop: 4 }}>
          {sorted[sorted.length - 1].name} a le moins bu ! 🥇
        </p>
      </div>

      {isHost && (
        <button className="btn btn-primary" onClick={() => socket.emit('replay')}>
          🔄 Rejouer (même salon)
        </button>
      )}
      {!isHost && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          En attente que l&apos;hôte relance…
        </p>
      )}
    </div>
  );
}
