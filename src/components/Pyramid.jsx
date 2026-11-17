import { useState } from 'react';
import { socket } from '../socket';
import EventLog from './EventLog';

// ── Pyramid component – the main game screen ─────────────────────────────────
export default function Pyramid({ state, cardReveal, onLeave }) {
  const [showAttackModal, setShowAttackModal] = useState(false);
  const [attackError, setAttackError]         = useState('');

  const {
    code, players, myCards, pyramid, currentCard,
    attackQueue, pendingChallenge, replacementFor,
    eventLog, isHost, settings,
  } = state;

  const me = players.find(p => p.isMe);

  // Is the top of the queue targeting me and no challenge in progress?
  const queueHead    = attackQueue[0];
  const isBeingAttacked =
    queueHead && queueHead.targetId === me?.id && !pendingChallenge && !replacementFor;

  // I need to pick a card position
  const mustRevealPosition = pendingChallenge?.isAttacker && !replacementFor;

  // Host can reveal next card when queue is empty
  const canRevealNext =
    isHost && attackQueue.length === 0 && !pendingChallenge && !replacementFor;

  // ── Handlers ────────────────────────────────────────────────────────────────

  function sendAttack(targetId) {
    setAttackError('');
    socket.emit('attack', { targetId }, res => {
      if (res?.error) setAttackError(res.error);
    });
    setShowAttackModal(false);
  }

  function acceptAttack() {
    socket.emit('respond_attack', { response: 'accept' });
  }

  function challengeAttack() {
    socket.emit('respond_attack', { response: 'challenge' });
  }

  function revealPosition(pos) {
    socket.emit('reveal_position', { position: pos });
  }

  function revealNext() {
    socket.emit('reveal_next_card', null, res => {
      if (res?.error) alert(res.error);
    });
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  const PyramidGrid = () => {
    const floors = pyramid.length;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
    const available = Math.min(vw - 24, 456);
    const gap = floors > 10 ? 3 : floors > 7 ? 4 : 6;
    const cardW = Math.max(20, Math.min(52, Math.floor((available - (floors - 1) * gap) / floors)));
    const cardH = Math.round(cardW * 72 / 52);
    const cardFs = `${Math.max(0.45, (cardW / 52) * 1.1).toFixed(2)}rem`;
    return (
    <div className="pyramid-wrap" style={{ gap }}>
      {pyramid.map((row, rowIdx) => (
        <div key={rowIdx} className="pyramid-row" style={{ gap }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: 28, textAlign: 'right', flexShrink: 0 }}>{rowIdx + 1}🍺</span>
          {row.map((card, colIdx) => {
            const isCurrent = currentCard?.floor === rowIdx && currentCard?.col === colIdx;
            return (
              <div key={colIdx} className="pyramid-card-wrap">
                <div
                  className={`playing-card pyramid-card ${card.revealed ? 'revealed' : ''} ${isCurrent ? 'current' : ''}`}
                  style={{ width: cardW, height: cardH, fontSize: cardFs }}
                >
                  {card.revealed ? card.value : ''}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
    );
  };

  const MyCards = ({ clickable }) => (
    <div className="my-cards-section">
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        {clickable ? '👆 Tape la position que tu prétends avoir' : 'Mes cartes (mémorisées)'}
      </p>
      <div className="my-cards-row">
        {myCards.map((val, i) => (
          <div
            key={i}
            className={`playing-card my-card ${clickable ? 'clickable' : ''}`}
            onClick={clickable ? () => revealPosition(i) : undefined}
          >
            {val !== null ? val : ''}
            <span className="pos-label">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Full-screen overlays ─────────────────────────────────────────────────────

  // Target must respond to attack
  if (isBeingAttacked) {
    return (
      <>
        <MainView PyramidGrid={PyramidGrid} MyCards={MyCards} eventLog={eventLog} />
        <div className="overlay">
          <div className="overlay-box" style={{ gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem' }}>⚔️</div>
              <h2 style={{ marginTop: 8 }}>{queueHead.attackerName} t&apos;attaque !</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                Carte : <strong style={{ color: 'var(--accent)' }}>{currentCard?.value}</strong>
                {' '}— étage {queueHead.floor + 1}
              </p>
              <p style={{ marginTop: 4 }}>
                <strong style={{ fontSize: '1.4rem', color: 'var(--warning)' }}>
                  {queueHead.sips} gorgée{queueHead.sips > 1 ? 's' : ''}
                </strong>
              </p>
            </div>

            <button className="btn btn-success" onClick={acceptAttack}>
              🍺 Je te crois, je bois ({queueHead.sips})
            </button>
            <button className="btn btn-danger" onClick={challengeAttack}>
              🫵 MENTEUR !
            </button>
          </div>

          {attackQueue.length > 1 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              +{attackQueue.length - 1} autre{attackQueue.length > 2 ? 's' : ''} attaque{attackQueue.length > 2 ? 's' : ''} en attente
            </p>
          )}
        </div>
      </>
    );
  }

  // Attacker must reveal a card position
  if (mustRevealPosition) {
    return (
      <>
        <MainView PyramidGrid={PyramidGrid} MyCards={MyCards} eventLog={eventLog} />
        <div className="overlay">
          <div className="overlay-box" style={{ gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem' }}>🃏</div>
              <h2 style={{ marginTop: 8 }}>{pendingChallenge.targetName} crie MENTEUR !</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                Montre la position où tu prétends avoir{' '}
                <strong style={{ color: 'var(--accent)' }}>{currentCard?.value}</strong>
              </p>
            </div>
            <div className="my-cards-row" style={{ justifyContent: 'center' }}>
              {myCards.map((val, i) => (
                <div
                  key={i}
                  className="playing-card my-card clickable"
                  onClick={() => revealPosition(i)}
                >
                  {val !== null ? val : ''}
                  <span className="pos-label">{i + 1}</span>
                </div>
              ))}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
              Tape sur la case où est ta carte
            </p>
          </div>
        </div>
      </>
    );
  }

  // Waiting for someone else's challenge
  const isWatchingChallenge = pendingChallenge && !pendingChallenge.isAttacker && !pendingChallenge.isTarget;
  const isChallengingTarget = pendingChallenge?.isTarget; // target called bluff, waiting for attacker

  return (
    <div className="pyramid-screen">
      {/* Header */}
      <div className="game-header">
        <span className="room-code-badge">{code}</span>
        {onLeave && (
          <button
            className="btn btn-ghost"
            style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem' }}
            onClick={onLeave}
          >Quitter</button>
        )}
        <div className="scores-row">
          {players.map(p => (
            <div key={p.id} className={`score-chip ${p.isMe ? 'me' : ''}`}>
              <span>{p.name}</span>
              <span style={{ color: 'var(--accent)' }}>🍺{p.sipsReceived}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pyramid */}
      <PyramidGrid />

      {/* Replacement banner */}
      {replacementFor && (
        <div className="replacement-banner">
          {replacementFor.isMe
            ? `🃏 Nouvelle carte en position ${replacementFor.position + 1} — mémorise-la !`
            : `⏳ ${replacementFor.playerName} mémorise sa nouvelle carte…`}
        </div>
      )}

      {/* Challenge status banner */}
      {isChallengingTarget && (
        <div className="replacement-banner" style={{ borderColor: 'var(--warning)', color: 'var(--warning)', background: 'rgba(244,165,58,0.1)' }}>
          ⏳ En attente que {pendingChallenge.attackerName} choisisse sa position…
        </div>
      )}
      {isWatchingChallenge && (
        <div className="replacement-banner" style={{ borderColor: 'var(--warning)', color: 'var(--warning)', background: 'rgba(244,165,58,0.1)' }}>
          ⏳ {pendingChallenge.targetName} a crié MENTEUR !<br />
          En attente que {pendingChallenge.attackerName} révèle sa carte…
        </div>
      )}

      {/* Card reveal toast */}
      {cardReveal && (
        <div className="replacement-banner" style={{
          borderColor: cardReveal.loser === 'target' ? 'var(--success)' : 'var(--danger)',
          color: cardReveal.loser === 'target' ? 'var(--success)' : 'var(--danger)',
          background: cardReveal.loser === 'target' ? 'rgba(86,194,84,0.1)' : 'rgba(233,69,96,0.1)',
        }}>
          {cardReveal.attackerName} révèle sa position {cardReveal.position + 1} :{' '}
          <strong>{cardReveal.value}</strong>
          {cardReveal.loser === 'target'
            ? ` ✓ Vrai ! ${cardReveal.sips} gorgées pour la cible`
            : ` ✗ Bluff ! ${cardReveal.sips} gorgées pour l'attaquant`}
        </div>
      )}

      {/* My cards */}
      <MyCards clickable={false} />

      {/* Error message */}
      {attackError && <p className="error-msg">{attackError}</p>}

      {/* Attack button */}
      {currentCard && !replacementFor && !pendingChallenge && (
        <button className="btn btn-primary" onClick={() => { setAttackError(''); setShowAttackModal(true); }}>
          🃏 J&apos;ai cette carte ! ({currentCard.value})
        </button>
      )}

      {/* Host reveal button */}
      {canRevealNext && (
        <button className="btn btn-secondary" onClick={revealNext}>
          {pyramid.every(row => row.every(c => c.revealed))
            ? '🏁 Terminer la partie'
            : '👉 Retourner la prochaine carte'}
        </button>
      )}
      {isHost && attackQueue.length > 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
          Résolvez toutes les attaques avant de continuer
        </p>
      )}

      {/* Attack queue */}
      {attackQueue.length > 0 && (
        <div className="attack-queue">
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>File d&apos;attaques ({attackQueue.length})</p>
          {attackQueue.map((a, i) => (
            <div key={a.id} className={`attack-item ${i === 0 ? 'active' : ''}`}>
              <span>
                <strong>{a.attackerName}</strong> → <strong>{a.targetName}</strong>
                <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({a.sips}🍺)</span>
              </span>
              {i === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>EN COURS</span>}
            </div>
          ))}
        </div>
      )}

      {/* Event log */}
      <EventLog events={eventLog} />

      {/* Attack target modal */}
      {showAttackModal && (
        <div className="overlay" onClick={() => setShowAttackModal(false)}>
          <div className="overlay-box" onClick={e => e.stopPropagation()}>
            <h2>⚔️ Qui attaques-tu ?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Carte : <strong>{currentCard?.value}</strong> — tu prétends l&apos;avoir
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {players.filter(p => !p.isMe).map(p => (
                <button
                  key={p.id}
                  className="btn btn-secondary"
                  onClick={() => sendAttack(p.id)}
                >
                  {p.name}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>
                    {p.sipsReceived}🍺 bues
                  </span>
                </button>
              ))}
            </div>
            <button className="btn btn-ghost" onClick={() => setShowAttackModal(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Shared background view (shown behind overlays)
function MainView({ PyramidGrid, MyCards, eventLog }) {
  return (
    <div className="pyramid-screen" style={{ filter: 'blur(2px)', pointerEvents: 'none', userSelect: 'none' }}>
      <PyramidGrid />
      <MyCards clickable={false} />
      <EventLog events={eventLog} />
    </div>
  );
}
