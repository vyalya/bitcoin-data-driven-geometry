// The connected gear keeps quantities separate from supporting structure.
// Highlighted connections explain protocol roles, not observed payment flows.
export const gearShapes: Record<string, string> = {
  blocks: 'Linked gear teeth',
  weight: 'Tooth length',
  transactions: 'Ivory spoke bars',
  'fees-total': 'Copper spoke bars',
  difficulty: 'Inner guard rim',
  hashrate: 'Outer guard rim',
  addresses: 'Central address field',
};

export const gearDescriptions: Record<string, string> = {
  blocks: 'One flat-ended tooth per block, arranged clockwise by height around the day’s full circle. The chain track joins consecutive heights only, leaving gaps and the last-to-first join open. Tooth directions are layout, not measurements or verified hash links.',
  weight: 'Tooth length = 0.12 visibility base + 0.75 × weight / 4,000,000 WU, extending from radius 1.5. Width follows tooth spacing. The modern 4 MWU reference compares all eras; it is not an early block limit.',
  transactions: 'Each block’s inner spoke carries an ivory bar: length = 0.58 × non-coinbase transactions / 7,928, the release maximum. Zero transactions leave the bar empty. The neighboring copper bar shows fees for that same block.',
  'fees-total': 'Each spoke’s copper bar shows its block’s fees: length = 0.58 × log1p(BTC) / log1p(37.62561499), the release maximum. Zero or missing fees leave it empty. The panel sums exact satoshis; logarithmic bar lengths are not additive.',
  difficulty: 'The inner guard rim fills by log10(mean block difficulty) / log10(release maximum). Difficulty 1 has no fill. Its 64-sided outline and dark backing are fixed references, not additional data or a security score.',
  hashrate: 'The outer guard rim fills by estimated daily EH/s / release maximum. Its 64-sided outline is fixed; missing estimates leave it unfilled. Hashrate is inferred from difficulty and block production, not directly observed miner activity.',
  addresses: 'The central field shows one dot per 1,000 active addresses in detail or 8,000 in the grid, rounded down; caps 1,500 / 180. Positions are illustrative. Addresses are not people or peers, and supporting rails are not payment links.',
};

export const gearLegendDefinitions: [string, string][] = [
  ['Blocks', gearDescriptions.blocks],
  ['Transactions', gearDescriptions.transactions],
  ['Weight', gearDescriptions.weight],
  ['Fees', gearDescriptions['fees-total']],
  ['Difficulty', gearDescriptions.difficulty],
  ['Hashrate', gearDescriptions.hashrate],
  ['Addresses', gearDescriptions.addresses],
];

export const gearRelations: Record<string, { title: string; text: string }> = {
  blocks: {
    title: 'A connected ledger',
    text: 'Each block contains transactions and follows the ledger by height. Its spoke carries transaction and fee bars. The guard rims evoke the proof of work that makes rewriting this history costly.',
  },
  weight: {
    title: 'Capacity inside each block',
    text: 'Weight measures a block’s use of capacity. Transaction sizes vary, so equally long teeth can contain different transaction counts. Their paired spoke bars reveal the transactions and fees behind each block.',
  },
  transactions: {
    title: 'Recorded together',
    text: 'Transactions are recorded inside blocks and contribute fees. Paired bars connect those two measurements to the same tooth. The address field gives daily context, without assigning particular addresses to individual blocks.',
  },
  'fees-total': {
    title: 'An incentive to mine',
    text: 'Fees from included transactions contribute to miners’ rewards, alongside the block subsidy. Highlighting the guard rims explains that incentive; it does not measure money flowing into computing power.',
  },
  difficulty: {
    title: 'The threshold for work',
    text: 'Difficulty sets how hard it is to find a valid block hash. It adjusts every 2,016 blocks toward ten-minute spacing. The two guard rims describe related roles in proof of work, not independent security scores.',
  },
  hashrate: {
    title: 'Work protecting history',
    text: 'Estimated hashrate describes computing effort, inferred from difficulty and block production. Proof of work makes rewriting history costly; full nodes still check that blocks obey Bitcoin’s rules. The supporting frame is illustrative.',
  },
  addresses: {
    title: 'Activity within the ledger',
    text: 'Active addresses participate in ledger changes. One person can use many addresses, and one address can serve many people. The central field gives daily context; its positions and structural connections do not map users or payments.',
  },
};
