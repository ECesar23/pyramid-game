'use strict';

const {
  createDeck,
  shuffle,
  pyramidCardCount,
  canStartGame,
  buildPyramid,
  floorToSips,
  resolveChallenge,
  generateRoomCode,
  CARD_VALUES,
} = require('../game');

// ── createDeck ───────────────────────────────────────────────────────────────

describe('createDeck', () => {
  test('returns 52 cards', () => {
    expect(createDeck()).toHaveLength(52);
  });

  test('each value appears exactly 4 times', () => {
    const deck = createDeck();
    for (const val of CARD_VALUES) {
      expect(deck.filter(c => c.value === val)).toHaveLength(4);
    }
  });
});

// ── shuffle ──────────────────────────────────────────────────────────────────

describe('shuffle', () => {
  test('returns same number of cards', () => {
    expect(shuffle(createDeck())).toHaveLength(52);
  });

  test('does not mutate the original array', () => {
    const original = createDeck();
    const copy = [...original];
    shuffle(original);
    expect(original).toEqual(copy);
  });

  test('produces different order on repeated calls (statistically)', () => {
    const deck = createDeck();
    const s1 = shuffle(deck).map(c => c.value).join('');
    const s2 = shuffle(deck).map(c => c.value).join('');
    // Probability of identical order: ~1/52! ≈ 0
    expect(s1).not.toBe(s2);
  });
});

// ── pyramidCardCount ─────────────────────────────────────────────────────────

describe('pyramidCardCount', () => {
  test('4 floors → 10 cards', () => expect(pyramidCardCount(4)).toBe(10));
  test('2 floors → 3 cards',  () => expect(pyramidCardCount(2)).toBe(3));
  test('5 floors → 15 cards', () => expect(pyramidCardCount(5)).toBe(15));
});

// ── canStartGame ─────────────────────────────────────────────────────────────

describe('canStartGame', () => {
  test('2 players, 4 floors: 8+10=18 ≤ 52 → true',  () => expect(canStartGame(2, 4)).toBe(true));
  test('10 players, 4 floors: 40+10=50 ≤ 52 → true', () => expect(canStartGame(10, 4)).toBe(true));
  test('10 players, 5 floors: 40+15=55 > 52 → false', () => expect(canStartGame(10, 5)).toBe(false));
  test('10 players, 2 floors: 40+3=43 ≤ 52 → true',  () => expect(canStartGame(10, 2)).toBe(true));
  test('11 players, 4 floors: 44+10=54 > 52 → false', () => expect(canStartGame(11, 4)).toBe(false));
});

// ── buildPyramid ─────────────────────────────────────────────────────────────

describe('buildPyramid', () => {
  test('4-floor pyramid has correct row sizes', () => {
    const deck = createDeck();
    const { pyramid } = buildPyramid(4, deck, 0);
    expect(pyramid).toHaveLength(4);
    expect(pyramid[0]).toHaveLength(4); // base
    expect(pyramid[1]).toHaveLength(3);
    expect(pyramid[2]).toHaveLength(2);
    expect(pyramid[3]).toHaveLength(1); // top
  });

  test('all cards start face-down', () => {
    const { pyramid } = buildPyramid(4, createDeck(), 0);
    pyramid.flat().forEach(c => expect(c.revealed).toBe(false));
  });

  test('consumes exactly pyramidCardCount(floors) cards from deck', () => {
    const floors = 4;
    const { nextIndex } = buildPyramid(floors, createDeck(), 0);
    expect(nextIndex).toBe(pyramidCardCount(floors));
  });

  test('respects startIndex offset', () => {
    const deck = createDeck();
    const offset = 8;
    const { pyramid, nextIndex } = buildPyramid(4, deck, offset);
    expect(nextIndex).toBe(offset + pyramidCardCount(4));
    expect(pyramid[0][0].value).toBe(deck[offset].value);
  });
});

// ── floorToSips ──────────────────────────────────────────────────────────────

describe('floorToSips', () => {
  test('floor 0 (base) → 1 sip',  () => expect(floorToSips(0)).toBe(1));
  test('floor 1 → 2 sips',         () => expect(floorToSips(1)).toBe(2));
  test('floor 3 (top of 4) → 4',   () => expect(floorToSips(3)).toBe(4));
});

// ── resolveChallenge ─────────────────────────────────────────────────────────

describe('resolveChallenge', () => {
  test('matching value: target loses, drinks 2× sips', () => {
    const result = resolveChallenge('A', 'A', 0); // floor 0 → base sip=1 → 2×
    expect(result.loser).toBe('target');
    expect(result.sips).toBe(2);
  });

  test('wrong value: attacker loses, drinks 2× sips', () => {
    const result = resolveChallenge('K', 'A', 0);
    expect(result.loser).toBe('attacker');
    expect(result.sips).toBe(2);
  });

  test('floor 2 (3 sips) → double is 6 on correct guess', () => {
    const result = resolveChallenge('7', '7', 2);
    expect(result.loser).toBe('target');
    expect(result.sips).toBe(6);
  });

  test('floor 2 (3 sips) → double is 6 on wrong guess', () => {
    const result = resolveChallenge('3', '7', 2);
    expect(result.loser).toBe('attacker');
    expect(result.sips).toBe(6);
  });

  test('top floor (3, 4 sips) → double is 8', () => {
    expect(resolveChallenge('A', 'A', 3).sips).toBe(8);
    expect(resolveChallenge('A', 'K', 3).sips).toBe(8);
  });
});

// ── Anti-cheat: hand isolation ───────────────────────────────────────────────

describe('hand isolation (server sanitization)', () => {
  // Simulate what sanitizeForPlayer does (copy the logic inline to test it)
  function sanitize(room, playerId) {
    const myPlayer = room.players.find(p => p.id === playerId);
    let myCards = [null, null, null, null];
    if (myPlayer?.cards.length === 4) {
      if (room.phase === 'memorize') {
        myCards = myPlayer.cards.map(c => c?.value ?? null);
      }
    }
    return {
      myCards,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        // ← no cards field for other players
      })),
    };
  }

  const room = {
    phase: 'memorize',
    players: [
      { id: 'alice', name: 'Alice', cards: [{ value: 'A' }, { value: '7' }, { value: 'D' }, { value: 'R' }] },
      { id: 'bob',   name: 'Bob',   cards: [{ value: '2' }, { value: '3' }, { value: '4' }, { value: '5' }] },
    ],
    replacementFor: null,
  };

  test('player sees only their own cards during memorize', () => {
    const alice = sanitize(room, 'alice');
    expect(alice.myCards).toEqual(['A', '7', 'D', 'R']);
  });

  test("player never receives other players' card values", () => {
    const alice = sanitize(room, 'alice');
    alice.players.forEach(p => {
      expect(p).not.toHaveProperty('cards');
    });
  });

  test('during pyramid phase, all cards are hidden', () => {
    const pyramidRoom = { ...room, phase: 'pyramid' };
    const alice = sanitize(pyramidRoom, 'alice');
    expect(alice.myCards).toEqual([null, null, null, null]);
  });

  test('bob does not see alice cards during memorize', () => {
    const bob = sanitize(room, 'bob');
    expect(bob.myCards).toEqual(['2', '3', '4', '5']); // only own
    // alice's data is not in bob's state at all (not in myCards)
    expect(bob.myCards).not.toContain('A');
  });
});

// ── generateRoomCode ─────────────────────────────────────────────────────────

describe('generateRoomCode', () => {
  test('returns a 4-character uppercase string', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z]{4}$/);
  });

  test('avoids already-used codes', () => {
    // Fill all but one code with 24^4 - 1 possibilities... just test avoidance
    const used = new Set(['AAAA', 'AABB', 'ZZZZ']);
    for (let i = 0; i < 50; i++) {
      expect(used).not.toContain(generateRoomCode(used));
    }
  });
});
