# makefun-token-radar-01-v3

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/RieryBuild/makefun-token-radar-01-v3/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/RieryBuild/makefun-token-radar-01-v3/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Every protocol with no token, priced off the tokens that already trade — and a farm plan for each one, netted to the dollar.

## Run it

```sh
node main.ts [--input <snapshot.json|directory>] [--output <directory>]
```

## How it works

Token Radar reads the sealed DefiLlama snapshot and ranks every pre-token protocol by implied launch value under the `radar-3` model:

```text
implied value = 10^(a + b·log10 TVL) × growth × maturity × chains
```

- **The launch curve is fitted, not typed in.** The 128 protocols whose token already trades are the comparables: a least-squares line of log10(market cap) on log10(TVL) is fitted to them at run time. The slope comes out near 0.52 — value grows with roughly the square root of TVL.
- **The fit is tested before it prices anything.** Leave-one-out over the comparables (median miss ×3.40, 32% inside 2×) and a blind time-split (trained on tokens listed before 2025, tested on the ones listed since: median miss ×3.08). A category-offset variant was tested the same way and dropped — it misses worse out of sample.
- **Growth** — the protocol's 7-day change, clamped to −60%…+120%, half weight.
- **Maturity** — 0.60 at listing, rising to 1.00 after 3 years running with no token.
- **Chains** — +2% per extra chain, capped at +10%.

No protocol's name ever changes its score. The board carries the whole watchlist plus every other rankable pre-token protocol at any TVL — 198 rows in this snapshot, including 20 above the watchlist floor that a floor-cut radar misses. Protocols whose token already trades are shown apart in the Live view, at their own market value, never mixed into the ranked board.

## Farm economics

Each row carries a farm verdict — FARM, THIN or SKIP — netted to the dollar under assumptions the dashboard states in full: the airdrop pool is 5% of the implied value, it splits among 5,000 qualifying wallets, and farming costs gas plus the yield on locked capital. Net = pool ÷ 5,000 − cost; FARM at $100 or more per wallet, THIN from $0, SKIP below $0. The wallet count is a scenario, not a fact — the pool and the cost are shown beside the net so a reader can re-run the arithmetic under any other count.

## Output

It reads the sealed snapshot (`--input`, else `MAKEFUN_INPUT_DIR`, else `/input/snapshot.json`) and writes to `--output`, else `MAKEFUN_OUTPUT_DIR`, else `/output`:

- `board.json` — the ranked board: rank, protocol, TVL, 7-day growth, age, implied value, the model's working, farm economics and a 6-step farm plan per row.
- `data.js` — the dashboard's whole dataset as one script.
- `dashboard/` — the static dashboard: the board (search, filter by category, chain and verdict, watchlist-only, sortable), a detail view with the model's working, the farm economics and the farm plan, and the Live view.
- `screenshots/` — the dashboard in three states.
- `dossier.json` — the dossier `vendor/makefun-board.ts` writes for the dashboard and screenshots.

Requirements: Node 22.18+ (verified on 22.23.4, the grader's runtime, under its exact sandbox conditions: uid 65534, minimal env, cwd `/`, no network). Standard library only — no install, no network.

## Notes on the build

- `vendor/makefun-board.ts` is the kit's own dossier library, copied verbatim from the competition kit's starter. The scorer runs the same file byte for byte, so the dossier matches by construction.
- Every path is resolved off `main.ts` itself (`import.meta.url`), never off the working directory: the grader runs `node /bot/main.ts` with the container's cwd at `/`, and a cwd-relative copy would fail there.
- “Pre-token” means the protocol's record carries no token — no market cap, no CoinGecko id, no symbol — not that it has promised one. Implied value is a ranking model, not a price prediction.

## License

[MIT](LICENSE)

---

<sub>Entered on [make.fun](https://make.fun/?ref=wa8s3t3t&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
