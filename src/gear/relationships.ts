// Highlighting expresses protocol roles, not a statistical correlation, an
// observed flow of funds, or a quantitative security / attack-resistance score.
const RELATIONSHIPS: Readonly<Record<string, readonly string[]>> = {
  spine: ['spine', 'transactions', 'fees-total', 'difficulty', 'hashrate'],
  transactions: ['transactions', 'spine', 'fees-total', 'particles'],
  'fees-total': ['fees-total', 'transactions', 'spine', 'difficulty', 'hashrate'],
  difficulty: ['difficulty', 'hashrate', 'spine'],
  hashrate: ['hashrate', 'difficulty', 'spine'],
  particles: ['particles', 'transactions'],
};
export function relationshipGroups(group: string | null | undefined): string[] {
  return group ? [...(RELATIONSHIPS[group] ?? [])] : [];
}

