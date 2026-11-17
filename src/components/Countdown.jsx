export default function Countdown({ value }) {
  const isGo = value === 0;
  return (
    <div className="countdown-screen">
      <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Préparez-vous à mémoriser…</p>
      <div
        className="countdown-number"
        key={value}
        style={{ color: isGo ? 'var(--success)' : 'var(--accent)' }}
      >
        {isGo ? 'GO !' : value}
      </div>
    </div>
  );
}
