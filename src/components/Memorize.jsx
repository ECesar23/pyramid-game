import { useState, useEffect } from 'react';

export default function Memorize({ state }) {
  const { myCards, settings } = state;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const e = (Date.now() - start) / 1000;
      setElapsed(e);
      if (e >= settings.memorizeDuration) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [settings.memorizeDuration]);

  const progress = Math.min(100, (elapsed / settings.memorizeDuration) * 100);
  const remaining = Math.max(0, settings.memorizeDuration - Math.floor(elapsed));

  return (
    <div className="screen" style={{ justifyContent: 'center', gap: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>👁️</div>
        <h2>Mémorise tes cartes !</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
          Elles disparaîtront dans <strong style={{ color: 'var(--accent)' }}>{remaining}s</strong>
        </p>
      </div>

      <div className="memorize-cards">
        {myCards.map((val, i) => (
          <div
            key={i}
            className="playing-card memorize-card"
            style={{ transition: 'all 0.3s' }}
          >
            <span style={{ fontSize: '1.6rem', fontWeight: 900 }}>{val ?? '?'}</span>
            <span className="pos-label">{i + 1}</span>
          </div>
        ))}
      </div>

      <div className="progress-bar-wrap">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
        Tu ne pourras plus les revoir après ce délai !
      </p>
    </div>
  );
}
