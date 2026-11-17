'use strict';

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuid } = require('uuid');
const {
  createDeck, shuffle, canStartGame, buildPyramid,
  floorToSips, resolveChallenge, generateRoomCode,
} = require('./game');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
const PORT = process.env.PORT || 3001;

// Serve built client in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) =>
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  );
}

// ── Room store ───────────────────────────────────────────────────────────────

const rooms = new Map(); // code → room

function createRoom(hostId, hostName, settings = {}) {
  const code = generateRoomCode(new Set(rooms.keys()));
  const room = {
    code,
    hostId,
    phase: 'lobby',
    settings: {
      floors:            clamp(settings.floors ?? 4, 2, 7),
      memorizeDuration:  clamp(settings.memorizeDuration ?? 3, 2, 10),
      replaceCard:       settings.replaceCard ?? true,
      finalRecitation:   settings.finalRecitation ?? false,
    },
    players: [],
    deck: [],
    deckIdx: 0,
    pyramid: [],
    currentCard: null,      // { floor, col, value }
    attackQueue: [],        // [{ id, attackerId, targetId, floor, col }]
    pendingChallenge: null, // { id, attackerId, targetId, floor, col }
    replacementFor: null,   // { playerId, position }
    eventLog: [],
    recitationState: null,
    timers: {},
  };
  addPlayerToRoom(room, hostId, hostName);
  rooms.set(code, room);
  return room;
}

function addPlayerToRoom(room, id, name) {
  room.players.push({
    id,
    name,
    cards: [],           // [{ value }] × 4
    sipsGiven: 0,
    sipsReceived: 0,
    challengesWon: 0,
    challengesLost: 0,
    connected: true,
  });
}

const findPlayer = (room, id) => room.players.find(p => p.id === id);
const getPlayerName = (room, id) => room.players.find(p => p.id === id)?.name ?? '?';
const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || min));

function logEvent(room, text) {
  room.eventLog.push({ id: uuid(), text, ts: Date.now() });
  if (room.eventLog.length > 100) room.eventLog.shift();
}

function clearRoomTimers(room) {
  Object.values(room.timers).forEach(t => { clearTimeout(t); clearInterval(t); });
  room.timers = {};
}

// ── State broadcasting ───────────────────────────────────────────────────────

function sanitizeForPlayer(room, playerId) {
  const myPlayer = findPlayer(room, playerId);

  // Cards visible only during memorize (or replacement memorization)
  let myCards = [null, null, null, null];
  if (myPlayer?.cards.length === 4) {
    if (room.phase === 'memorize' && !room.replacementFor) {
      myCards = myPlayer.cards.map(c => c?.value ?? null);
    } else if (room.replacementFor?.playerId === playerId) {
      const pos = room.replacementFor.position;
      myCards = [null, null, null, null];
      myCards[pos] = myPlayer.cards[pos]?.value ?? null;
    }
  }

  return {
    code: room.code,
    phase: room.phase,
    isHost: room.hostId === playerId,
    settings: room.settings,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      sipsGiven: p.sipsGiven,
      sipsReceived: p.sipsReceived,
      challengesWon: p.challengesWon,
      challengesLost: p.challengesLost,
      connected: p.connected,
      isMe: p.id === playerId,
    })),
    myCards,                // null = face-down; value = visible
    pyramid: room.pyramid.map(row =>
      row.map(c => ({ revealed: c.revealed, value: c.revealed ? c.value : null }))
    ),
    currentCard: room.currentCard,
    attackQueue: room.attackQueue.map(a => ({
      id: a.id,
      attackerId: a.attackerId,
      attackerName: getPlayerName(room, a.attackerId),
      targetId: a.targetId,
      targetName: getPlayerName(room, a.targetId),
      floor: a.floor,
      sips: floorToSips(a.floor),
    })),
    pendingChallenge: room.pendingChallenge ? {
      ...room.pendingChallenge,
      attackerName: getPlayerName(room, room.pendingChallenge.attackerId),
      targetName:   getPlayerName(room, room.pendingChallenge.targetId),
      isAttacker: room.pendingChallenge.attackerId === playerId,
      isTarget:   room.pendingChallenge.targetId   === playerId,
    } : null,
    replacementFor: room.replacementFor ? {
      isMe:     room.replacementFor.playerId === playerId,
      playerName: getPlayerName(room, room.replacementFor.playerId),
      position: room.replacementFor.position,
    } : null,
    eventLog: room.eventLog.slice(-30),
    recitationState: room.recitationState ? {
      playerIndex:       room.recitationState.playerIndex,
      currentPlayerId:   room.players[room.recitationState.playerIndex]?.id,
      currentPlayerName: room.players[room.recitationState.playerIndex]?.name,
      results:           room.recitationState.results,
      isMyTurn: room.players[room.recitationState.playerIndex]?.id === playerId,
      totalPlayers: room.players.length,
    } : null,
  };
}

function broadcastState(room) {
  for (const p of room.players) {
    const sock = io.sockets.sockets.get(p.id);
    if (sock) sock.emit('state', sanitizeForPlayer(room, p.id));
  }
}

// ── Game phases ──────────────────────────────────────────────────────────────

function startCountdown(room) {
  room.phase = 'countdown';
  broadcastState(room);

  let n = 3;
  const tick = () => {
    io.to(room.code).emit('countdown', n);
    if (n === 0) {
      startMemorize(room);
    } else {
      n--;
      room.timers.countdown = setTimeout(tick, 1000);
    }
  };
  tick();
}

function startMemorize(room) {
  room.phase = 'memorize';
  broadcastState(room);
  room.timers.memorize = setTimeout(() => endMemorize(room), room.settings.memorizeDuration * 1000);
}

function endMemorize(room) {
  room.phase = 'pyramid';
  logEvent(room, 'La mémorisation est terminée. La pyramide commence !');
  broadcastState(room);
}

function revealNextCard(room) {
  for (let row = 0; row < room.pyramid.length; row++) {
    for (let col = 0; col < room.pyramid[row].length; col++) {
      if (!room.pyramid[row][col].revealed) {
        room.pyramid[row][col].revealed = true;
        const { value } = room.pyramid[row][col];
        const sips = floorToSips(row);
        room.currentCard = { floor: row, col, value };
        logEvent(room, `Carte retournée : ${value} — étage ${row + 1} (${sips} gorgée${sips > 1 ? 's' : ''})`);
        broadcastState(room);
        return;
      }
    }
  }
  endGame(room);
}

function processQueue(room) {
  if (room.attackQueue.length === 0) {
    room.pendingChallenge = null;
    broadcastState(room);
  } else {
    broadcastState(room); // let target see their response buttons
  }
}

function acceptAttack(room, attack) {
  const sips = floorToSips(attack.floor);
  const target   = findPlayer(room, attack.targetId);
  const attacker = findPlayer(room, attack.attackerId);
  if (target)   target.sipsReceived   += sips;
  if (attacker) attacker.sipsGiven    += sips;
  logEvent(room, `${getPlayerName(room, attack.targetId)} accepte et boit ${sips} gorgée${sips > 1 ? 's' : ''}`);
  room.attackQueue.shift();
  processQueue(room);
}

function initiateChallenge(room, attack) {
  room.pendingChallenge = {
    id: attack.id,
    attackerId: attack.attackerId,
    targetId: attack.targetId,
    floor: attack.floor,
    col: attack.col,
  };
  logEvent(room, `${getPlayerName(room, attack.targetId)} crie MENTEUR ! à ${getPlayerName(room, attack.attackerId)}`);
  broadcastState(room);
}

function resolvePosition(room, attackerId, position) {
  const ch = room.pendingChallenge;
  if (!ch || ch.attackerId !== attackerId) return;

  const attacker = findPlayer(room, ch.attackerId);
  const target   = findPlayer(room, ch.targetId);
  if (!attacker || !target) return;

  const revealedValue = attacker.cards[position]?.value ?? null;
  const pyramidValue  = room.pyramid[ch.floor][ch.col].value;
  const result = resolveChallenge(revealedValue, pyramidValue, ch.floor);

  // Broadcast the revealed card to everyone
  io.to(room.code).emit('card_revealed', {
    attackerName: attacker.name,
    position,
    value: revealedValue,
    pyramidValue,
    loser: result.loser,
    sips: result.sips,
  });

  if (result.loser === 'target') {
    target.sipsReceived   += result.sips;
    attacker.sipsGiven    += result.sips;
    attacker.challengesWon++;
    logEvent(room, `✓ ${attacker.name} avait bien ${pyramidValue} ! ${target.name} boit ${result.sips} gorgées.`);
  } else {
    attacker.sipsReceived += result.sips;
    target.sipsGiven      += result.sips;
    attacker.challengesLost++;
    logEvent(room, `✗ ${attacker.name} bluffait ! ${attacker.name} boit ${result.sips} gorgées.`);
  }

  room.pendingChallenge = null;
  room.attackQueue.shift();

  if (room.settings.replaceCard && room.deckIdx < room.deck.length) {
    const newCard = room.deck[room.deckIdx++];
    attacker.cards[position] = { value: newCard.value };
    room.replacementFor = { playerId: attacker.id, position };
    logEvent(room, `${attacker.name} reçoit une nouvelle carte en position ${position + 1}`);
    broadcastState(room);

    room.timers.replacement = setTimeout(() => {
      room.replacementFor = null;
      processQueue(room);
    }, room.settings.memorizeDuration * 1000);
    return;
  }

  processQueue(room);
}

function endGame(room) {
  if (room.settings.finalRecitation) {
    room.phase = 'recitation';
    room.recitationState = { playerIndex: 0, results: {} };
    logEvent(room, 'Récitation finale ! Chaque joueur annonce ses cartes dans l\'ordre.');
  } else {
    room.phase = 'results';
    logEvent(room, 'Partie terminée !');
  }
  broadcastState(room);
}

function handleRecitation(room, playerId, recitedValues) {
  const st = room.recitationState;
  if (!st) return;
  const current = room.players[st.playerIndex];
  if (!current || current.id !== playerId) return;

  let wrong = 0;
  const details = [];
  for (let i = 0; i < 4; i++) {
    const actual  = current.cards[i]?.value ?? null;
    const guessed = recitedValues[i] ?? null;
    const correct = actual === guessed;
    if (!correct) wrong++;
    details.push({ position: i + 1, actual, guessed, correct });
  }
  current.sipsReceived += wrong;
  st.results[playerId] = { details, wrong, name: current.name };
  logEvent(room, `${current.name} récite ses cartes : ${wrong} erreur${wrong !== 1 ? 's' : ''} → ${wrong} gorgée${wrong !== 1 ? 's' : ''}`);

  st.playerIndex++;
  if (st.playerIndex >= room.players.length) {
    room.phase = 'results';
    logEvent(room, 'Partie terminée !');
  }
  broadcastState(room);
}

function replayGame(room) {
  clearRoomTimers(room);
  Object.assign(room, {
    phase: 'lobby',
    deck: [], deckIdx: 0, pyramid: [],
    currentCard: null, attackQueue: [],
    pendingChallenge: null, replacementFor: null, recitationState: null,
  });
  for (const p of room.players) {
    Object.assign(p, { cards: [], sipsGiven: 0, sipsReceived: 0, challengesWon: 0, challengesLost: 0 });
  }
  logEvent(room, 'Nouvelle partie ! En attente du lancement...');
  broadcastState(room);
}

// ── Socket.io events ─────────────────────────────────────────────────────────

function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.id === socketId)) return room;
  }
  return null;
}

io.on('connection', socket => {

  socket.on('create_room', ({ name, settings } = {}, cb = () => {}) => {
    if (!name?.trim()) return cb({ error: 'Pseudo invalide' });
    const room = createRoom(socket.id, name.trim(), settings ?? {});
    socket.join(room.code);
    cb({ ok: true, code: room.code });
    broadcastState(room);
  });

  socket.on('join_room', ({ code, name } = {}, cb = () => {}) => {
    const room = rooms.get(code?.toUpperCase());
    if (!room) return cb({ error: 'Salon introuvable' });

    // Reconnection during active game
    if (room.phase !== 'lobby') {
      const existing = room.players.find(p => p.name === name?.trim());
      if (!existing) return cb({ error: 'La partie a déjà commencé' });
      const oldSock = io.sockets.sockets.get(existing.id);
      if (oldSock) oldSock.leave(room.code);
      existing.id = socket.id;
      existing.connected = true;
      socket.join(room.code);
      cb({ ok: true, code: room.code });
      broadcastState(room);
      return;
    }

    if (!name?.trim()) return cb({ error: 'Pseudo invalide' });
    if (room.players.length >= 10) return cb({ error: 'Salon plein (10 joueurs max)' });
    if (room.players.find(p => p.name === name.trim())) return cb({ error: 'Pseudo déjà pris' });

    addPlayerToRoom(room, socket.id, name.trim());
    socket.join(room.code);
    logEvent(room, `${name.trim()} a rejoint la partie`);
    cb({ ok: true, code: room.code });
    broadcastState(room);
  });

  socket.on('rejoin_room', ({ code, name } = {}, cb = () => {}) => {
    const room = rooms.get(code?.toUpperCase());
    if (!room) return cb({ error: 'Salon introuvable' });
    const existing = room.players.find(p => p.name === name?.trim());
    if (!existing) return cb({ error: 'Joueur non trouvé' });
    const oldSock = io.sockets.sockets.get(existing.id);
    if (oldSock && oldSock.id !== socket.id) oldSock.leave(room.code);
    existing.id = socket.id;
    existing.connected = true;
    socket.join(room.code);
    cb({ ok: true, code: room.code });
    broadcastState(room);
  });

  socket.on('update_settings', (settings = {}) => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return;
    const s = room.settings;
    if (settings.floors            != null) s.floors            = clamp(settings.floors, 2, 7);
    if (settings.memorizeDuration  != null) s.memorizeDuration  = clamp(settings.memorizeDuration, 2, 10);
    if (settings.replaceCard       != null) s.replaceCard       = Boolean(settings.replaceCard);
    if (settings.finalRecitation   != null) s.finalRecitation   = Boolean(settings.finalRecitation);
    broadcastState(room);
  });

  socket.on('start_game', (_, cb = () => {}) => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return cb({ error: 'Non autorisé' });
    if (room.phase !== 'lobby') return cb({ error: 'Partie déjà lancée' });
    if (room.players.length < 2) return cb({ error: 'Il faut au moins 2 joueurs' });
    if (!canStartGame(room.players.length, room.settings.floors))
      return cb({ error: `Pas assez de cartes. Réduisez les étages ou le nombre de joueurs.` });

    const deck = shuffle(createDeck());
    let idx = 0;
    for (const p of room.players) {
      p.cards = deck.slice(idx, idx + 4).map(c => ({ value: c.value }));
      idx += 4;
    }
    const { pyramid, nextIndex } = buildPyramid(room.settings.floors, deck, idx);
    room.pyramid = pyramid;
    room.deck = deck;
    room.deckIdx = nextIndex;

    cb({ ok: true });
    startCountdown(room);
  });

  socket.on('attack', ({ targetId } = {}, cb = () => {}) => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.phase !== 'pyramid') return cb({ error: 'Impossible maintenant' });
    if (!room.currentCard) return cb({ error: 'Aucune carte retournée' });
    if (socket.id === targetId) return cb({ error: 'Impossible de s\'attaquer soi-même' });
    if (!findPlayer(room, targetId)) return cb({ error: 'Joueur introuvable' });

    const { floor, col } = room.currentCard;
    const attack = { id: uuid(), attackerId: socket.id, targetId, floor, col };
    room.attackQueue.push(attack);

    const sips = floorToSips(floor);
    logEvent(room, `${getPlayerName(room, socket.id)} attaque ${getPlayerName(room, targetId)} (${sips} gorgée${sips > 1 ? 's' : ''})`);
    cb({ ok: true });
    broadcastState(room);
  });

  socket.on('respond_attack', ({ response } = {}, cb = () => {}) => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.phase !== 'pyramid') return cb({ error: 'Impossible' });
    const attack = room.attackQueue[0];
    if (!attack || attack.targetId !== socket.id) return cb({ error: 'Non autorisé' });
    if (room.pendingChallenge) return cb({ error: 'Un défi est en cours' });

    if (response === 'accept') {
      acceptAttack(room, attack);
    } else if (response === 'challenge') {
      initiateChallenge(room, attack);
    } else {
      return cb({ error: 'Réponse invalide' });
    }
    cb({ ok: true });
  });

  socket.on('reveal_position', ({ position } = {}, cb = () => {}) => {
    const room = findRoomBySocket(socket.id);
    if (!room || !room.pendingChallenge) return cb({ error: 'Aucun défi en cours' });
    if (room.pendingChallenge.attackerId !== socket.id) return cb({ error: 'Non autorisé' });
    if (position < 0 || position > 3) return cb({ error: 'Position invalide (0-3)' });

    resolvePosition(room, socket.id, position);
    cb({ ok: true });
  });

  socket.on('reveal_next_card', (_, cb = () => {}) => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.phase !== 'pyramid') return cb({ error: 'Impossible' });
    if (room.hostId !== socket.id) return cb({ error: 'Réservé à l\'hôte' });
    if (room.attackQueue.length > 0) return cb({ error: 'Résolvez d\'abord toutes les attaques' });
    if (room.pendingChallenge) return cb({ error: 'Un défi est en cours' });
    if (room.replacementFor) return cb({ error: 'Mémorisation en cours' });

    const allRevealed = room.pyramid.every(row => row.every(c => c.revealed));
    if (allRevealed) endGame(room);
    else revealNextCard(room);
    cb({ ok: true });
  });

  socket.on('submit_recitation', ({ values } = {}, cb = () => {}) => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.phase !== 'recitation') return cb({ error: 'Impossible' });
    if (!Array.isArray(values) || values.length !== 4) return cb({ error: 'Format invalide' });
    handleRecitation(room, socket.id, values);
    cb({ ok: true });
  });

  socket.on('replay', () => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id || room.phase !== 'results') return;
    replayGame(room);
  });

  socket.on('disconnect', () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const p = findPlayer(room, socket.id);
    if (p) {
      p.connected = false;
      logEvent(room, `${p.name} s'est déconnecté`);
      broadcastState(room);
    }
  });
});

httpServer.listen(PORT, () => console.log(`🃏  Pyramide server on port ${PORT}`));
