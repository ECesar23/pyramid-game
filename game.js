'use strict';

const CARD_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];

function createDeck(numDecks = 1) {
  const deck = [];
  for (let d = 0; d < numDecks; d++) {
    for (const value of CARD_VALUES) {
      for (let suit = 0; suit < 4; suit++) deck.push({ value });
    }
  }
  return deck; // 52 * numDecks cards
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// pyramid[0] = base (floors cards), pyramid[floors-1] = top (1 card)
function pyramidCardCount(floors) {
  return (floors * (floors + 1)) / 2;
}

function canStartGame(playerCount, floors, numDecks = 1) {
  return playerCount * 4 + pyramidCardCount(floors) <= 52 * numDecks;
}

// Returns { pyramid: [][]{value,revealed}, nextIndex }
function buildPyramid(floors, deck, startIndex) {
  const pyramid = [];
  let idx = startIndex;
  for (let row = 0; row < floors; row++) {
    const colCount = floors - row;
    const rowArr = [];
    for (let col = 0; col < colCount; col++) {
      rowArr.push({ value: deck[idx++].value, revealed: false });
    }
    pyramid.push(rowArr);
  }
  return { pyramid, nextIndex: idx };
}

// floor 0 (base) = 1 sip, floor floors-1 (top) = floors sips
function floorToSips(floorIndex) {
  return floorIndex + 1;
}

// { loser: 'target'|'attacker', sips }
function resolveChallenge(attackerCardValue, pyramidCardValue, floorIndex) {
  const sips = floorToSips(floorIndex) * 2;
  return attackerCardValue === pyramidCardValue
    ? { loser: 'target', sips }    // attacker was right → target drinks ×2
    : { loser: 'attacker', sips }; // attacker bluffed  → attacker drinks ×2
}

function generateRoomCode(usedCodes = new Set()) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O
  let code, tries = 0;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (usedCodes.has(code) && ++tries < 1000);
  return code;
}

module.exports = {
  CARD_VALUES,
  createDeck,
  shuffle,
  pyramidCardCount,
  canStartGame,
  buildPyramid,
  floorToSips,
  resolveChallenge,
  generateRoomCode,
};
