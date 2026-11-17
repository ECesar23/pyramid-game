import { useState, useEffect, useCallback } from 'react';
import { socket } from './socket';
import Lobby from './components/Lobby';
import LobbyRoom from './components/LobbyRoom';
import Countdown from './components/Countdown';
import Memorize from './components/Memorize';
import Pyramid from './components/Pyramid';
import Recitation from './components/Recitation';
import Results from './components/Results';

export default function App() {
  const [gameState, setGameState] = useState(null);
  const [inRoom, setInRoom]       = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [cardReveal, setCardReveal] = useState(null); // { attackerName, position, value, loser, sips }

  const tryRejoin = useCallback(() => {
    const code = localStorage.getItem('pyramide_code');
    const name = localStorage.getItem('pyramide_name');
    if (code && name) {
      socket.emit('rejoin_room', { code, name }, res => {
        if (res.error) {
          localStorage.removeItem('pyramide_code');
          localStorage.removeItem('pyramide_name');
        } else {
          setInRoom(true);
        }
      });
    }
  }, []);

  useEffect(() => {
    socket.on('state', state => {
      setGameState(state);
      setInRoom(true);
    });

    socket.on('countdown', n => {
      setCountdown(n);
    });

    socket.on('card_revealed', data => {
      setCardReveal(data);
      setTimeout(() => setCardReveal(null), 3000);
    });

    socket.on('connect', tryRejoin);
    if (socket.connected) tryRejoin();

    return () => {
      socket.off('state');
      socket.off('countdown');
      socket.off('card_revealed');
      socket.off('connect', tryRejoin);
    };
  }, [tryRejoin]);

  function handleJoined(code, name) {
    localStorage.setItem('pyramide_code', code);
    localStorage.setItem('pyramide_name', name);
    setInRoom(true);
  }

  function handleLeave() {
    localStorage.removeItem('pyramide_code');
    localStorage.removeItem('pyramide_name');
    setGameState(null);
    setInRoom(false);
  }

  if (!inRoom) return <Lobby onJoined={handleJoined} />;
  if (!gameState) return <div className="loading-screen">Connexion…</div>;

  switch (gameState.phase) {
    case 'lobby':
      return <LobbyRoom state={gameState} onLeave={handleLeave} />;

    case 'countdown':
      return <Countdown value={countdown} />;

    case 'memorize':
      return <Memorize state={gameState} />;

    case 'pyramid':
      return <Pyramid state={gameState} cardReveal={cardReveal} onLeave={handleLeave} />;

    case 'recitation':
      return <Recitation state={gameState} />;

    case 'results':
      return <Results state={gameState} />;

    default:
      return <div className="loading-screen">Phase inconnue: {gameState.phase}</div>;
  }
}
