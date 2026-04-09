/**
 * Real Bitcoin network data from Strategy Mosaic semantic layer.
 * Model: "bitcoin network and mining pools daily analytics"
 * 25 historically significant events, all data queried via Mosaic MCP.
 */
import type { NetworkSnapshot } from "../types";
import { blockData } from "./blockData";

/* ─── Ring band derivation from metrics ─── */

export function deriveRingBands(snapshot: {
  feePressureIndex: number;
  congestionScore: number;
  blockProductionStress: number;
  mempoolTxCount: number;
  networkHealthScore: number;
}) {
  const fp = snapshot.feePressureIndex / 10;
  const cg = snapshot.congestionScore / 10;
  const bs = snapshot.blockProductionStress / 10;
  const mp = Math.min(snapshot.mempoolTxCount / 400000, 1);
  const health = snapshot.networkHealthScore / 10;

  return [
    { id: "rb-1", label: "Inner fee band", radius: 2.0, density: 0.4 + fp * 0.5, intensity: 0.3 + fp * 0.6, activeShare: 0.4 + fp * 0.5 },
    { id: "rb-2", label: "Settlement band", radius: 2.85, density: 0.5 + (1 - bs) * 0.4, intensity: 0.4 + health * 0.4, activeShare: 0.5 + health * 0.35 },
    { id: "rb-3", label: "Congestion band", radius: 3.75, density: 0.35 + cg * 0.55, intensity: 0.3 + cg * 0.6, activeShare: 0.3 + mp * 0.6 },
    { id: "rb-4", label: "Outer mempool band", radius: 4.85, density: 0.3 + mp * 0.6, intensity: 0.25 + cg * 0.5, activeShare: 0.35 + mp * 0.5 },
  ];
}

/* ─── Helpers ─── */

/* Pool distributions from Mosaic — 3 distinct periods */
const POOLS_PRE2024 = [
  { id: "foundry", name: "Foundry USA", sharePct: 0.300 },
  { id: "antpool", name: "AntPool", sharePct: 0.215 },
  { id: "viabtc", name: "ViaBTC", sharePct: 0.119 },
  { id: "f2pool", name: "F2Pool", sharePct: 0.115 },
  { id: "mara", name: "MARA Pool", sharePct: 0.043 },
  { id: "binance", name: "Binance Pool", sharePct: 0.039 },
  { id: "spider", name: "SpiderPool", sharePct: 0.037 },
  { id: "luxor", name: "Luxor", sharePct: 0.028 },
  { id: "secpool", name: "SECPOOL", sharePct: 0.023 },
  { id: "sbi", name: "SBI Crypto", sharePct: 0.016 },
];
const POOLS_2024 = [
  { id: "foundry", name: "Foundry USA", sharePct: 0.300 },
  { id: "antpool", name: "AntPool", sharePct: 0.202 },
  { id: "viabtc", name: "ViaBTC", sharePct: 0.127 },
  { id: "f2pool", name: "F2Pool", sharePct: 0.108 },
  { id: "spider", name: "SpiderPool", sharePct: 0.055 },
  { id: "mara", name: "MARA Pool", sharePct: 0.047 },
  { id: "secpool", name: "SECPOOL", sharePct: 0.032 },
  { id: "luxor", name: "Luxor", sharePct: 0.029 },
  { id: "binance", name: "Binance Pool", sharePct: 0.023 },
  { id: "sbi", name: "SBI Crypto", sharePct: 0.015 },
];
const POOLS_2025 = [
  { id: "foundry", name: "Foundry USA", sharePct: 0.296 },
  { id: "antpool", name: "AntPool", sharePct: 0.178 },
  { id: "viabtc", name: "ViaBTC", sharePct: 0.116 },
  { id: "f2pool", name: "F2Pool", sharePct: 0.109 },
  { id: "spider", name: "SpiderPool", sharePct: 0.079 },
  { id: "mara", name: "MARA Pool", sharePct: 0.049 },
  { id: "secpool", name: "SECPOOL", sharePct: 0.037 },
  { id: "luxor", name: "Luxor", sharePct: 0.034 },
  { id: "binance", name: "Binance Pool", sharePct: 0.021 },
  { id: "sbi", name: "SBI Crypto", sharePct: 0.016 },
];

function poolsForDate(date: string, hashrate: number) {
  const pools = date >= "2025-10-10" ? POOLS_2025 : date >= "2024-04-20" ? POOLS_2024 : POOLS_PRE2024;
  return pools.map((p) => ({ ...p, hashRateEh: Math.round(hashrate * p.sharePct), shareChange30d: 0 }));
}

function bkt(s0: number, s1: number, s2: number, s3: number) {
  return [
    { id: "low", feeRateLabel: "1-10 sat/vB", txShare: s0, intensity: Math.min(s0 / 0.25, 1) },
    { id: "mid", feeRateLabel: "11-30 sat/vB", txShare: s1, intensity: Math.min(s1 / 0.3, 1) },
    { id: "high", feeRateLabel: "31-80 sat/vB", txShare: s2, intensity: Math.min(s2 / 0.25, 1) },
    { id: "priority", feeRateLabel: "81+ sat/vB", txShare: s3, intensity: Math.min(s3 / 0.2, 1) },
  ];
}

/* GBQ address/value data per snapshot */
interface GbqData {
  activeAddresses: number;
  uniqueSenders: number;
  uniqueReceivers: number;
  btcTransferred: number;
  totalFeesBtc: number;
  totalOutputs: number;
  whaleOutputs1000: number;
  whaleOutputs100: number;
  midOutputs10: number;
  retailOutputs: number;
}

/* GBQ data keyed by date — from BigQuery crypto_bitcoin dataset */
const GBQ: Record<string, GbqData> = {
  "2009-01-09": { activeAddresses: 0, uniqueSenders: 0, uniqueReceivers: 0, btcTransferred: 0, totalFeesBtc: 0, totalOutputs: 0, whaleOutputs1000: 0, whaleOutputs100: 0, midOutputs10: 0, retailOutputs: 0 },
  "2010-05-22": { activeAddresses: 165, uniqueSenders: 137, uniqueReceivers: 28, btcTransferred: 54428, totalFeesBtc: 0, totalOutputs: 233, whaleOutputs1000: 7, whaleOutputs100: 9, midOutputs10: 210, retailOutputs: 7 },
  "2011-06-19": { activeAddresses: 39669, uniqueSenders: 16175, uniqueReceivers: 23494, btcTransferred: 4573896, totalFeesBtc: 0, totalOutputs: 29666, whaleOutputs1000: 107, whaleOutputs100: 1956, midOutputs10: 5017, retailOutputs: 22586 },
  "2013-04-10": { activeAddresses: 185959, uniqueSenders: 79368, uniqueReceivers: 106591, btcTransferred: 2880396, totalFeesBtc: 0.306, totalOutputs: 169321, whaleOutputs1000: 380, whaleOutputs100: 4326, midOutputs10: 17447, retailOutputs: 147168 },
  "2014-02-24": { activeAddresses: 325083, uniqueSenders: 134120, uniqueReceivers: 190963, btcTransferred: 776198, totalFeesBtc: 0.209, totalOutputs: 256989, whaleOutputs1000: 108, whaleOutputs100: 898, midOutputs10: 7541, retailOutputs: 248442 },
  "2015-01-14": { activeAddresses: 396394, uniqueSenders: 179860, uniqueReceivers: 216534, btcTransferred: 2405987, totalFeesBtc: 0.074, totalOutputs: 307313, whaleOutputs1000: 396, whaleOutputs100: 2554, midOutputs10: 18120, retailOutputs: 286243 },
  "2016-07-09": { activeAddresses: 615602, uniqueSenders: 257213, uniqueReceivers: 358389, btcTransferred: 1891223, totalFeesBtc: 0, totalOutputs: 509494, whaleOutputs1000: 46, whaleOutputs100: 3630, midOutputs10: 21407, retailOutputs: 484411 },
  "2017-12-20": { activeAddresses: 1405796, uniqueSenders: 547079, uniqueReceivers: 858717, btcTransferred: 2227875, totalFeesBtc: 0, totalOutputs: 994169, whaleOutputs1000: 107, whaleOutputs100: 2589, midOutputs10: 27739, retailOutputs: 963734 },
  "2018-12-15": { activeAddresses: 858440, uniqueSenders: 429866, uniqueReceivers: 428574, btcTransferred: 813096, totalFeesBtc: 0, totalOutputs: 632386, whaleOutputs1000: 89, whaleOutputs100: 992, midOutputs10: 8641, retailOutputs: 622664 },
  "2019-06-26": { activeAddresses: 1437717, uniqueSenders: 640343, uniqueReceivers: 797374, btcTransferred: 1866108, totalFeesBtc: 47.212, totalOutputs: 1096503, whaleOutputs1000: 139, whaleOutputs100: 2847, midOutputs10: 23612, retailOutputs: 1069905 },
  "2020-03-12": { activeAddresses: 1268406, uniqueSenders: 604780, uniqueReceivers: 663626, btcTransferred: 2351187, totalFeesBtc: 7.823, totalOutputs: 892697, whaleOutputs1000: 194, whaleOutputs100: 2879, midOutputs10: 21882, retailOutputs: 867742 },
  "2020-05-11": { activeAddresses: 1308509, uniqueSenders: 653335, uniqueReceivers: 655174, btcTransferred: 1165275, totalFeesBtc: 15.708, totalOutputs: 849885, whaleOutputs1000: 78, whaleOutputs100: 1507, midOutputs10: 13155, retailOutputs: 835145 },
  "2021-04-14": { activeAddresses: 1480841, uniqueSenders: 622746, uniqueReceivers: 858095, btcTransferred: 1825475, totalFeesBtc: 0, totalOutputs: 1055366, whaleOutputs1000: 101, whaleOutputs100: 2396, midOutputs10: 9360, retailOutputs: 1043509 },
  "2021-06-28": { activeAddresses: 1011263, uniqueSenders: 422188, uniqueReceivers: 589075, btcTransferred: 1666846, totalFeesBtc: 0, totalOutputs: 726578, whaleOutputs1000: 156, whaleOutputs100: 1376, midOutputs10: 6857, retailOutputs: 718189 },
  "2021-11-10": { activeAddresses: 1387739, uniqueSenders: 638693, uniqueReceivers: 749046, btcTransferred: 4611902, totalFeesBtc: 24.691, totalOutputs: 937868, whaleOutputs1000: 560, whaleOutputs100: 2276, midOutputs10: 9850, retailOutputs: 925182 },
  "2022-02-24": { activeAddresses: 1286000, uniqueSenders: 604349, uniqueReceivers: 681651, btcTransferred: 4283224, totalFeesBtc: 0, totalOutputs: 865268, whaleOutputs1000: 270, whaleOutputs100: 2453, midOutputs10: 9180, retailOutputs: 853365 },
  "2022-11-11": { activeAddresses: 1351968, uniqueSenders: 600475, uniqueReceivers: 751493, btcTransferred: 4083748, totalFeesBtc: 0, totalOutputs: 981757, whaleOutputs1000: 577, whaleOutputs100: 2995, midOutputs10: 12842, retailOutputs: 965343 },
  "2023-01-14": { activeAddresses: 1383736, uniqueSenders: 654758, uniqueReceivers: 728978, btcTransferred: 923781, totalFeesBtc: 0, totalOutputs: 945895, whaleOutputs1000: 27, whaleOutputs100: 2019, midOutputs10: 6999, retailOutputs: 936850 },
  "2023-12-16": { activeAddresses: 1077281, uniqueSenders: 431640, uniqueReceivers: 645641, btcTransferred: 562624, totalFeesBtc: 0, totalOutputs: 1679829, whaleOutputs1000: 31, whaleOutputs100: 784, midOutputs10: 3608, retailOutputs: 1675406 },
  "2024-01-11": { activeAddresses: 1314254, uniqueSenders: 642997, uniqueReceivers: 671257, btcTransferred: 1151913, totalFeesBtc: 94.324, totalOutputs: 1261057, whaleOutputs1000: 188, whaleOutputs100: 1421, midOutputs10: 7676, retailOutputs: 1251772 },
  "2024-03-14": { activeAddresses: 1307118, uniqueSenders: 634100, uniqueReceivers: 673018, btcTransferred: 1276450, totalFeesBtc: 0, totalOutputs: 1091219, whaleOutputs1000: 149, whaleOutputs100: 1553, midOutputs10: 6797, retailOutputs: 1082720 },
  "2024-04-20": { activeAddresses: 731536, uniqueSenders: 269653, uniqueReceivers: 461883, btcTransferred: 385320, totalFeesBtc: 1621.007, totalOutputs: 1907729, whaleOutputs1000: 34, whaleOutputs100: 190, midOutputs10: 3272, retailOutputs: 1904233 },
  "2024-11-10": { activeAddresses: 1077866, uniqueSenders: 503522, uniqueReceivers: 574344, btcTransferred: 808961, totalFeesBtc: 17.318, totalOutputs: 1394994, whaleOutputs1000: 96, whaleOutputs100: 1377, midOutputs10: 5925, retailOutputs: 1387596 },
  "2025-01-20": { activeAddresses: 1132720, uniqueSenders: 513504, uniqueReceivers: 619216, btcTransferred: 961130, totalFeesBtc: 0, totalOutputs: 968086, whaleOutputs1000: 138, whaleOutputs100: 1354, midOutputs10: 8290, retailOutputs: 958304 },
  "2025-10-10": { activeAddresses: 1075408, uniqueSenders: 479699, uniqueReceivers: 595709, btcTransferred: 750439, totalFeesBtc: 0, totalOutputs: 1100889, whaleOutputs1000: 38, whaleOutputs100: 911, midOutputs10: 8010, retailOutputs: 1091930 },
};

function mk(
  id: string, label: string, date: string,
  bh: number, intv: number, hr: number,
  mp: number, mpMb: number,
  fp: number, cg: number, bs: number, mc: number, nh: number,
  diff: number,
  notes: string[]
): NetworkSnapshot {
  const s = { feePressureIndex: fp, congestionScore: cg, blockProductionStress: bs, mempoolTxCount: mp, networkHealthScore: nh };
  const g = GBQ[date] ?? GBQ["2009-01-09"];
  return {
    id, label,
    snapshotTime: `${date}T00:00:00Z`,
    mode: "historical" as const,
    blockHeight: bh,
    avgBlockIntervalSeconds: intv,
    networkHashrateEh: hr,
    mempoolSizeMb: mpMb,
    minerConcentrationScore: mc,
    difficulty: diff,
    ...g,
    ...s,
    miningPools: poolsForDate(date, hr),
    feeBuckets: bkt(0.334, 0.295, 0.207, 0.164),
    ringBands: deriveRingBands(s),
    notes,
    blocks: blockData[date] ?? [],
  };
}

/* ═══════════════════════════════════════════════════════════════════
   25 EVENTS — chronological, all from Mosaic
   ═══════════════════════════════════════════════════════════════════ */

export const mosaicSnapshots: NetworkSnapshot[] = [
  mk("genesis", "Genesis Era", "2009-01-09",
    982, 600, 0, 0, 0, 0.87, 0, 0.92, 4.0, 8.55, 1,
    ["6 days after genesis block. Satoshi mining alone on a CPU.", "The entire Bitcoin network: one node, one miner, zero transactions."]),

  mk("pizza", "Pizza Day", "2010-05-22",
    70542, 600, 0, 0, 0, 0.87, 0, 0.92, 4.0, 8.55, 11.85,
    ["10,000 BTC for two pizzas — first real-world Bitcoin purchase.", "Block 70K. Worth ~$40 at the time. Worth ~$700M in 2024."]),

  mk("bubble-2011", "2011 Bubble Burst", "2011-06-19",
    125436, 600, 0, 0, 0, 0.87, 0, 0.92, 4.0, 8.55, 876954,
    ["First major bubble — BTC hit $31 then crashed to $2.", "Mt. Gox hacked for the first time. Early chaos."]),

  mk("bubble-2013", "2013 Bubble Pop", "2013-04-10",
    217811, 452, 0, 0, 0, 0.87, 0, 2.4, 4.0, 8.18, 7673000,
    ["BTC fell from $266 to $50 in hours.", "Fast blocks (452s) — ASICs arriving, hashrate surging."]),

  mk("mtgox", "Mt. Gox Collapse", "2014-02-24",
    262509, 452, 0.026, 0, 0, 0.87, 0, 2.4, 4.0, 8.18, 3129573175,
    ["Mt. Gox declared bankruptcy. 850,000 BTC lost.", "Hashrate barely 0.026 EH/s. Dark day for Bitcoin trust."]),

  mk("bear-2015", "2015 Bear Bottom", "2015-01-14",
    307720, 596, 0.358, 0, 0, 0.87, 0, 0.96, 4.0, 8.54, 43971662056,
    ["BTC ~$200. Deepest bear market despair.", "Network quietly building — 0.36 EH/s, steady blocks."]),

  mk("halving-2016", "2016 Halving", "2016-07-09",
    383425, 600, 1.581, 0, 0, 0.87, 0, 0.92, 4.0, 8.55, 213398925331,
    ["2nd halving — subsidy 25 → 12.5 BTC per block.", "1.6 EH/s. Calm before the 2017 storm."]),

  mk("bull-2017", "2017 Bull Run Peak", "2017-12-20",
    457316, 600, 13.036, 343354, 98.1, 2.87, 4.68, 0.92, 4.0, 6.88, 1873105475221,
    ["BTC near $20K. 343K mempool transactions.", "13 EH/s hashrate. Congestion score 4.7 — network stressed."]),

  mk("bear-2018", "2018 Capitulation", "2018-12-15",
    507601, 600, 40.98, 1909, 0.55, 0.87, 0, 0.92, 4.0, 8.55, 5646403851535,
    ["BTC bottomed near $3,200. Blood in the streets.", "Network: 41 EH/s, empty mempool, perfectly healthy."]),

  mk("rally-2019", "2019 Mini Rally", "2019-06-26",
    534579, 524, 65.2, 76318, 21.8, 1.63, 1.06, 1.69, 4.0, 7.9, 7409399249090,
    ["BTC briefly hit $13K. 76K mempool building.", "Fast blocks (524s) — hashrate surging to 65 EH/s."]),

  mk("covid", "COVID Black Thursday", "2020-03-12",
    570882, 572, 108.6, 27228, 7.8, 1.06, 0.3, 1.2, 4.0, 8.36, 16552923967337,
    ["Global pandemic panic. BTC dropped 50% in 24 hours.", "Mempool spiked to 27K. Blocks fast at 572s."]),

  mk("halving-2020", "2020 Halving", "2020-05-11",
    579270, 550, 108.9, 4185, 1.2, 0.96, 0, 1.42, 4.0, 8.4, 16104807485529,
    ["3rd halving — subsidy 12.5 → 6.25 BTC.", "109 EH/s, clear mempool. Recovery underway."]),

  mk("coinbase", "Coinbase IPO", "2021-04-14",
    626469, 600, 155.3, 257070, 73.4, 2.58, 3.91, 0.92, 4.0, 7.15, 23137439666472,
    ["Coinbase went public on NASDAQ. BTC at $64K.", "257K mempool — heavy institutional-driven congestion."]),

  mk("china-ban", "China Mining Ban", "2021-06-28",
    636945, 600, 109.0, 0, 0, 0.87, 0, 0.92, 4.0, 8.55, 19932791027263,
    ["China banned mining. Hashrate crashed from 180→109 EH/s.", "Paradoxically healthy — low fees, clear mempool."]),

  mk("ath-2021", "2021 ATH $69K", "2021-11-10",
    655806, 580, 145.4, 33053, 9.4, 1.22, 0.38, 1.12, 4.0, 8.32, 21659344833265,
    ["Bitcoin hit $69K all-time high.", "Fast blocks (580s), moderate mempool. Bull market peak."]),

  mk("ukraine", "Ukraine War Begins", "2022-02-24",
    670608, 600, 183.5, 0, 0, 0.87, 0, 0.92, 4.0, 8.55, 27967152532434,
    ["Russia invaded Ukraine. BTC used for cross-border aid.", "Network unfazed — 184 EH/s, perfect block intervals."]),

  mk("ftx", "FTX Collapse", "2022-11-11",
    706924, 600, 244.9, 11692, 3.3, 0.92, 0.09, 0.92, 4.0, 8.52, 36762198818467,
    ["FTX and Alameda collapsed. Contagion spread across crypto.", "Bitcoin network: 245 EH/s, normal blocks. Unfazed."]),

  mk("recovery-2023", "2023 Recovery", "2023-01-14",
    715864, 600, 289.8, 2533, 0.72, 0.87, 0, 0.92, 4.0, 8.55, 34093570325204,
    ["Bear market ending. BTC climbing from $16K.", "290 EH/s — hashrate grew through the entire bear."]),

  mk("inscriptions", "Inscription Surge", "2023-12-16",
    762796, 600, 528.4, 346023, 98.9, 2.87, 4.68, 0.92, 4.0, 6.88, 67305906902031,
    ["Ordinals inscriptions flood the network. 346K mempool.", "528 EH/s. Congestion 4.7 — similar to 2017 peak."]),

  mk("etf", "BTC ETF Approved", "2024-01-11",
    766457, 499, 482.0, 0, 0, 1.41, 0, 1.93, 4.0, 8.16, 73197634206448,
    ["SEC approved spot Bitcoin ETFs. Institutional era begins.", "Fast blocks (499s) — miners racing. 482 EH/s."]),

  mk("ath-2024", "2024 ATH $73K", "2024-03-14",
    775228, 600, 630.4, 379934, 108.6, 2.87, 4.76, 0.92, 4.0, 6.86, 79351228131137,
    ["New ATH ~$73K driven by ETF inflows.", "380K mempool — highest congestion in dataset. Health: 6.9."]),

  mk("halving-2024", "2024 Halving", "2024-04-20",
    780382, 665, 642.3, 0, 0, 2.87, 0, 2.62, 3.9, 7.65, 86388558925171,
    ["4th halving — subsidy 6.25 → 3.125 BTC.", "642 EH/s. Slower blocks (665s). Mempool cleared."]),

  mk("election", "Post-Election Rally", "2024-11-10",
    808895, 584, 700.8, 243425, 69.6, 2.6, 3.69, 1.09, 3.9, 7.18, 101646843652785,
    ["US election rally toward $90K. Pro-crypto sentiment.", "243K mempool. 701 EH/s — network handling demand."]),

  mk("trump", "Trump Inauguration", "2025-01-20",
    818808, 600, 718.9, 0, 0, 0.87, 0, 0.92, 3.9, 8.58, 110451907374650,
    ["Pro-crypto president inaugurated.", "719 EH/s. Network calm and extremely healthy."]),

  mk("correction", "2025 Correction", "2025-10-10",
    855544, 600, 906.5, 8688, 2.5, 0.9, 0.05, 0.92, 3.6, 8.64, 150839487445892,
    ["Market correction — prices declining.", "907 EH/s all-time high hashrate. Network doesn't care about price."]),

];
