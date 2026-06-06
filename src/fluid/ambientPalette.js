// The weighted colour roll for the self-generated ("ambient") splashes that keep
// the fluid alive when the user isn't interacting. Kept in one place so the
// palette can never drift between the pages that share the engine.
//
// Weights: 70% cyan, 10% purple, 10% magenta, 5% gold, 5% teal.
// `rand` is injectable for testing; defaults to Math.random.
export function rollAmbientColor(rand = Math.random) {
  const colorRoll = rand()
  if (colorRoll < 0.7) {
    return { r: 0, g: 0.7 + rand() * 0.2, b: 0.8 + rand() * 0.15 }
  }
  if (colorRoll < 0.8) {
    return { r: 0.5 + rand() * 0.3, g: 0.2, b: 0.8 + rand() * 0.2 }
  }
  if (colorRoll < 0.9) {
    return { r: 0.9 + rand() * 0.1, g: 0.3 + rand() * 0.2, b: 0.6 + rand() * 0.2 }
  }
  if (colorRoll < 0.95) {
    return { r: 1.0, g: 0.7 + rand() * 0.2, b: 0.2 + rand() * 0.1 }
  }
  return { r: 0.2, g: 0.8 + rand() * 0.2, b: 0.5 + rand() * 0.2 }
}
