// Shared pure helpers used by client components (no server import)
export const pyramidCardCountClient = floors => (floors * (floors + 1)) / 2;
export const floorToSipsClient = floorIndex => floorIndex + 1;
export const canStartClient = (playerCount, floors) =>
  playerCount * 4 + pyramidCardCountClient(floors) <= 52;
