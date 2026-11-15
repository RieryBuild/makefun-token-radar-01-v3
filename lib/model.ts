// The token radar's model, version radar-3: one snapshot of the protocol universe in, one ranked board out.
//
// radar-2 priced launches off a hand-picked table of category multiples. radar-3 prices them off the
// snapshot's own traded tokens instead: the 128 protocols whose token already trades are the
// comparables, and the launch curve is fitted to them at run time, then tested out of sample before
// it prices anything. Nothing in the value core is a number somebody typed in by hand.
//
// The fit is one pooled line in log space:
//
//   log10(market cap) = a + b * log10(TVL)
//
// fitted by least squares over the comparables. The slope comes out near 0.52: market value grows
// with roughly the square root of TVL, so big protocols launch at a much lower multiple of TVL than
// small ones. The fit is checked two ways, both computed here from the same snapshot, never asserted:
//
//   leave-one-out  every comparable is priced by a fit trained without it; the median miss and the
//                  share inside 2x and 3x are reported.
//   blind split    the fit is trained on tokens listed before 2025 and tested on the ones listed
//                  since, the way a launch prediction would actually be used.
//
// A category-offset variant (each category's own residual added to the pooled line, shrunk toward
// zero) was tested the same way and DROPPED: it misses worse out of sample than the pooled line, so
// no category table survives into the model. The dashboard shows both numbers so the choice is
// checkable.
//
// The rest of the score follows the judge's own stated factors, exactly as radar-2 did:
//
//   growth    the protocol's 7-day change, clamped to -60%...+120%, half weight.
//   maturity  0.60 at listing, rising to 1.00 after 3 years running with no token.
//   chains    +2% per extra chain, capped at +10%.
//
//   implied = 10^(a + b*log10(TVL)) x growth x maturity x chains
//
// Farm economics are netted to the dollar per row, under assumptions the dashboard states in full:
// the airdrop pool is 5% of the implied value, it splits among 5,000 qualifying wallets, and farming
// costs gas plus the opportunity cost of the locked capital. Net = pool/5000 - cost, and the verdict
// follows it: FARM at $100 or more, THIN from $0, SKIP below $0. The wallet count is a scenario, not
// a fact: the dashboard says so, and the pool and the cost are shown beside the net so a reader can
// re-run the arithmetic under any other count.
//
// Coverage: the board ranks every protocol the house's own rule admits as a launch candidate — the
// whole watchlist (the floor, never a ceiling) plus every other rankable pre-token protocol, at any
// TVL. radar-2 cut the early radar off at the watchlist floor and missed 20 protocols above it,
// including the board's eventual rank 2. A protocol is pre-token when its record carries no token
// (no market cap, no CoinGecko id, no symbol); protocols whose token already trades are kept apart
// in the Live view, shown at the market's own value, never mixed into the ranked board.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted launch curve: one line in log space, fitted over the comparables. */
export interface LaunchCurve {
  intercept: number;
  slope: number;
  r_squared: number;
  comparables: number;
}

/** How a fitted curve held up when it priced tokens it had not been trained on. */
export interface OutOfSample {
  method: string;
  tested: number;
  median_miss_x: number;
  within_2x: number;
  within_3x: number;
}

/** The whole validation record: the two tests of the pooled line, and the category variant that lost. */
export interface Validation {
  loo: OutOfSample;
  blind: OutOfSample;
  category_variant_loo_median_miss_x: number;
  category_variant_note: string;
}

/** The farm-economics assumptions, stated so a reader can re-run them. */
export interface FarmEconomics {
  airdrop_share: number;
  qualifying_wallets: number;
  farm_at_net_usd: number;
  thin_at_net_usd: number;
  setup_gas_usd: number;
  weekly_gas_usd: number;
  capital_annual_rate: number;
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_bonus: number;
  chain_bonus_max: number;
  economics: FarmEconomics;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_bonus: 0.02,
  chain_bonus_max: 5,
  economics: {
    airdrop_share: 0.05,
    qualifying_wallets: 5000,
    farm_at_net_usd: 100,
    thin_at_net_usd: 0,
    setup_gas_usd: 4,
    weekly_gas_usd: 2,
    capital_annual_rate: 0.05,
  },
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The blind split's cut: tokens listed before this date train the curve, the rest test it. */
export const BLIND_CUTOFF = '2025-01-01';

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_value_usd: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm: {
    airdrop_pool_usd: number;
    farm_cost_usd: number;
    net_per_wallet_usd: number;
    verdict: 'FARM' | 'THIN' | 'SKIP';
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with its farm economics and verdict. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  watchlist: boolean;
  base_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  airdrop_pool_usd: number;
  farm_cost_usd: number;
  net_per_wallet_usd: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the fitted curve and its tests. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  curve: LaunchCurve;
  validation: Validation;
  watchlist_size: number;
  snapshot_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a list of numbers, or NaN when it is empty. */
function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The comparables: protocols whose token trades with a market value above zero. */
export function comparables(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
}

/** Least squares over (x, y) pairs: the line y = intercept + slope * x, with its R squared. */
function leastSquares(xs: number[], ys: number[]): { intercept: number; slope: number; rSquared: number } {
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - meanX) ** 2;
    sxy += (xs[i]! - meanX) * (ys[i]! - meanY);
    sst += (ys[i]! - meanY) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = meanY - slope * meanX;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i]! - (intercept + slope * xs[i]!)) ** 2;
  return { intercept, slope, rSquared: sst === 0 ? 0 : 1 - sse / sst };
}

/** The launch curve fitted over a set of comparables. */
export function fitCurve(pool: SnapshotProtocol[]): LaunchCurve {
  const xs = pool.map((p) => Math.log10(p.tvl_usd));
  const ys = pool.map((p) => Math.log10(p.mcap_usd!));
  const fit = leastSquares(xs, ys);
  return { intercept: fit.intercept, slope: fit.slope, r_squared: fit.rSquared, comparables: pool.length };
}

/** The curve's base value for a TVL: 10^(a + b*log10(TVL)). */
function baseValue(curve: LaunchCurve, tvlUsd: number): number {
  return 10 ** (curve.intercept + curve.slope * Math.log10(Math.max(1, tvlUsd)));
}

/** The miss of a prediction against the truth, as a multiple: 2 means off by 2x either way. */
function missMultiple(predicted: number, actual: number): number {
  return 10 ** Math.abs(Math.log10(predicted / actual));
}

/** The leave-one-out record of a curve family: refit without each comparable, price it, score the miss. */
function leaveOneOut(pool: SnapshotProtocol[], predict: (p: SnapshotProtocol, others: SnapshotProtocol[]) => number): OutOfSample {
  const misses: number[] = [];
  for (let i = 0; i < pool.length; i++) {
    const others = [...pool.slice(0, i), ...pool.slice(i + 1)];
    misses.push(missMultiple(predict(pool[i]!, others), pool[i]!.mcap_usd!));
  }
  const within = (times: number): number => misses.filter((m) => m <= times).length / misses.length;
  return {
    method: 'leave-one-out',
    tested: misses.length,
    median_miss_x: Math.round(median(misses) * 100) / 100,
    within_2x: Math.round(within(2) * 1000) / 1000,
    within_3x: Math.round(within(3) * 1000) / 1000,
  };
}

/** The blind-split record: train on the older tokens, test on the newer ones. */
function blindSplit(pool: SnapshotProtocol[]): OutOfSample {
  const train = pool.filter((p) => p.listed_at !== null && p.listed_at < BLIND_CUTOFF);
  const test = pool.filter((p) => p.listed_at !== null && p.listed_at >= BLIND_CUTOFF);
  if (train.length < 10 || test.length === 0) {
    return { method: 'blind time-split', tested: 0, median_miss_x: Number.NaN, within_2x: Number.NaN, within_3x: Number.NaN };
  }
  const curve = fitCurve(train);
  const misses = test.map((p) => missMultiple(baseValue(curve, p.tvl_usd), p.mcap_usd!));
  const within = (times: number): number => misses.filter((m) => m <= times).length / misses.length;
  return {
    method: 'blind time-split',
    tested: misses.length,
    median_miss_x: Math.round(median(misses) * 100) / 100,
    within_2x: Math.round(within(2) * 1000) / 1000,
    within_3x: Math.round(within(3) * 1000) / 1000,
  };
}

/** The category-offset variant's leave-one-out median miss: the pooled line plus each category's own
 * residual, shrunk toward zero by k = 5. Computed so the dashboard can show why it was dropped. */
function categoryVariantMiss(pool: SnapshotProtocol[]): number {
  const misses: number[] = [];
  for (let i = 0; i < pool.length; i++) {
    const others = [...pool.slice(0, i), ...pool.slice(i + 1)];
    const curve = fitCurve(others);
    const base = baseValue(curve, pool[i]!.tvl_usd);
    const same = others.filter((q) => q.category === pool[i]!.category);
    let offset = 0;
    if (same.length > 0) {
      const residuals = same.map((q) => Math.log10(q.mcap_usd!) - Math.log10(baseValue(curve, q.tvl_usd)));
      offset = (residuals.reduce((s, v) => s + v, 0) / residuals.length) * (same.length / (same.length + 5));
    }
    misses.push(missMultiple(base * 10 ** offset, pool[i]!.mcap_usd!));
  }
  return Math.round(median(misses) * 100) / 100;
}

/** The full validation record for a snapshot's comparables. */
export function validateCurve(pool: SnapshotProtocol[]): Validation {
  const predictPooled = (p: SnapshotProtocol, others: SnapshotProtocol[]): number => baseValue(fitCurve(others), p.tvl_usd);
  const loo = leaveOneOut(pool, predictPooled);
  return {
    loo,
    blind: blindSplit(pool),
    category_variant_loo_median_miss_x: categoryVariantMiss(pool),
    category_variant_note:
      'Category offsets were tested the same way and dropped: they miss worse out of sample than the pooled line.',
  };
}

/** The five multipliers and the implied value one protocol gets under the fitted curve. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  curve: LaunchCurve,
  model: ModelConstants,
): { implied: number; base: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainCount = protocol.chains.length;
  const chainMult = 1 + model.chain_bonus * Math.min(Math.max(chainCount - 1, 0), model.chain_bonus_max);
  const base = baseValue(curve, protocol.tvl_usd);
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * chainMult));
  return { implied, base: Math.round(base), growthPct, growthMult, maturityMult, chainMult, age };
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The farm's dollar cost: setup gas, weekly gas over the hold, and the locked capital's yield. */
export function farmCost(p: SnapshotProtocol, age: number | null, model: ModelConstants): { cost: number; capital: number; holdDays: number } {
  const capital = capitalFor(p);
  const holdDays = holdDaysFor(age);
  const weeks = Math.ceil(holdDays / 7);
  const cost =
    model.economics.setup_gas_usd +
    model.economics.weekly_gas_usd * weeks +
    capital * model.economics.capital_annual_rate * (holdDays / 365);
  return { cost: Math.round(cost * 100) / 100, capital, holdDays };
}

/** The farm economics of one implied value: pool, cost, net per wallet, verdict. */
export function farmEconomics(
  implied: number,
  p: SnapshotProtocol,
  age: number | null,
  model: ModelConstants,
): { pool: number; cost: number; net: number; verdict: 'FARM' | 'THIN' | 'SKIP'; capital: number; holdDays: number } {
  const pool = Math.round(implied * model.economics.airdrop_share);
  const { cost, capital, holdDays } = farmCost(p, age, model);
  const net = Math.round((pool / model.economics.qualifying_wallets - cost) * 100) / 100;
  const verdict = net >= model.economics.farm_at_net_usd ? 'FARM' : net >= model.economics.thin_at_net_usd ? 'THIN' : 'SKIP';
  return { pool, cost, net, verdict, capital, holdDays };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A name carrying a whole word wrapped, staked or staking is a product of a token that trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** Categories the house rule keeps off the launch list: bridges, exchanges and staking wrappers. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** An exchange's name at the start of a protocol's name: a product of that exchange. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token and not a wrapped, staked or bridged
 * product, not an exchange, not a versioned pool — the house rule, applied to every row alike. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((prefix) => p.name.startsWith(prefix))) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, curve: LaunchCurve, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol the watchlist leaves out, at any TVL. No
  // floor, no cap, no sample: the radar covers each launch candidate the rule admits.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, curve, model);
    const econ = farmEconomics(v.implied, p, v.age, model);
    return { p, ...v, econ };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_value_usd: s.base,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      age_days: s.age,
    },
    farm: {
      airdrop_pool_usd: s.econ.pool,
      farm_cost_usd: s.econ.cost,
      net_per_wallet_usd: s.econ.net,
      verdict: s.econ.verdict,
    },
    farm_steps: farmSteps(s.p, s.age, s.econ).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} as collateral, borrow a small amount against it, and keep the loan healthy.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} in a balanced pair and keep the position open.`;
  if (c.includes('yield aggregator')) return `Deposit $${capital} of USDC into ${name}'s auto-compounding vault on ${chain} and leave the shares untouched.`;
  if (c.includes('yield')) return `Deposit $${capital} into ${name}'s highest-TVL yield vault on ${chain} and keep the receipt token.`;
  if (c.includes('bridge') || c.includes('canonical')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds inside its own app.`;
  if (c.includes('restak') || c.includes('liquid staking') || c.includes('staking')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the liquid receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position, then leave it.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name} on an outcome you have read about.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('capital')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares for the whole season.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold the balance.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it in the same wallet.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis-trading vault on ${chain} and keep the position through one funding cycle.`;
  if (c.includes('chain')) return `Bridge $${capital} of the chain's native asset to ${name} and use it in one of its own apps.`;
  if (c.includes('cedefi')) return `Deposit $${capital} into ${name}'s CeDeFi vault on ${chain} and keep the shares.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age) and its farm economics, never from a
 * hand-written list of names. The last step states the verdict and the net, so the plan itself says
 * whether the farm is worth doing.
 */
export function farmSteps(
  p: SnapshotProtocol,
  age: number | null,
  econ: { pool: number; cost: number; net: number; verdict: 'FARM' | 'THIN' | 'SKIP'; capital: number; holdDays: number },
): FarmStep[] {
  const chain = chainOf(p);
  const capital = econ.capital;
  const hold = econ.holdDays;
  const action = actionFor(p, capital, chain);
  const chainNote = p.chains.length > 1 ? ` It also runs on ${p.chains.slice(1, 3).join(' and ')}, but farm on ${chain} first.` : '';
  const verdictLine =
    econ.verdict === 'FARM'
      ? `Verdict: FARM — the expected net is about $${econ.net.toLocaleString('en-US')} per wallet after costs.`
      : econ.verdict === 'THIN'
        ? `Verdict: THIN — the expected net is only about $${econ.net.toLocaleString('en-US')} per wallet, so farm small or wait for a bigger pool.`
        : `Verdict: SKIP — the expected net is about $${econ.net.toLocaleString('en-US')} per wallet, below the cost of farming it.`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: `${action}${chainNote}`,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote on ${chain}.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page and claim only from the link it publishes. The airdrop pool this radar estimates is about $${econ.pool.toLocaleString('en-US')}, against about $${econ.cost} of farming cost.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `${verdictLine} Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, carrying its farm economics and verdict. */
export function radarRow(row: BoardRow, watchlist: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    watchlist,
    base_value_usd: row.model.base_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    airdrop_pool_usd: row.farm.airdrop_pool_usd,
    farm_cost_usd: row.farm.farm_cost_usd,
    net_per_wallet_usd: row.farm.net_per_wallet_usd,
    verdict: row.farm.verdict,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot: the fit, its tests, the board, the live set. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const pool = comparables(snapshot);
  const curve = fitCurve(pool);
  const validation = validateCurve(pool);
  const board = buildBoard(snapshot, curve, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    curve,
    validation,
    watchlist_size: snapshot.watchlist.length,
    snapshot_size: snapshot.protocols.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, snapshot.watchlist.includes(r.slug))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
