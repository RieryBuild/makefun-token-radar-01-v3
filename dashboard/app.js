// Token Radar's dashboard: it reads window.RADAR (written beside dashboard/ by main.ts) and renders
// the ranked board, the fitted curve with its out-of-sample tests, a per-protocol detail view with
// the model's working and the farm plan netted to the dollar, and the live-token list. No network:
// every byte it shows is in data.js. The farm steps are rendered verbatim from the row, the same
// strings board.json carries, so the page and the board can never disagree. Filters and the open
// detail are kept in the URL hash, so a state can be linked and screenshotted.

(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) {
    document.body.innerHTML = '<p style="padding:2rem">data.js did not load.</p>';
    return;
  }

  var state = { q: '', category: 'all', chain: 'all', verdict: 'all', watch: false, sort: 'implied', detail: null };

  function $(id) { return document.getElementById(id); }
  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toLocaleString('en-US');
  }
  function fullMoney(n) {
    if (n === null || n === undefined) return '—';
    return '$' + n.toLocaleString('en-US');
  }
  function signedMoney(n) {
    if (n === null || n === undefined) return '—';
    var s = n < 0 ? '−$' : '$';
    return s + Math.abs(n).toLocaleString('en-US');
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function ageText(days) {
    if (days === null || days === undefined) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.floor(days / 30) + 'm';
    return (days / 365).toFixed(1) + 'y';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function chainsText(r) {
    if (!r.chains || r.chains.length === 0) return '—';
    return r.chains.length <= 2 ? r.chains.join(', ') : r.chains[0] + ' +' + (r.chains.length - 1);
  }

  // ---- masthead + model panel ---------------------------------------------------------------
  $('asof').textContent = DATA.as_of;
  $('stat-total').textContent = DATA.snapshot_size.toLocaleString('en-US');
  $('stat-board').textContent = DATA.board_size.toLocaleString('en-US');
  $('stat-watch').textContent = DATA.watchlist_size + ' / ' + DATA.watchlist_size;
  $('stat-live').textContent = DATA.live_size.toLocaleString('en-US');
  $('live-count').textContent = DATA.live_size;

  var c = DATA.curve;
  var v = DATA.validation;
  $('fit-line').textContent =
    'log10(mcap) = ' + c.intercept.toFixed(3) + ' + ' + c.slope.toFixed(3) + ' × log10(TVL), R² ' +
    c.r_squared.toFixed(2) + ' over ' + c.comparables + ' comparables';
  var fitRows = [
    ['Comparables', c.comparables + ' tokens that trade, mcap > $0'],
    ['Slope', c.slope.toFixed(3) + ' — value grows with roughly the square root of TVL'],
    ['R²', c.r_squared.toFixed(3)],
    ['Leave-one-out', 'median miss ×' + v.loo.median_miss_x.toFixed(2) + ' over ' + v.loo.tested + ' tokens; ' +
      (v.loo.within_2x * 100).toFixed(0) + '% inside 2×, ' + (v.loo.within_3x * 100).toFixed(0) + '% inside 3×'],
    ['Blind time-split', 'trained on tokens listed before 2025, tested on the ' + v.blind.tested + ' listed since: ' +
      'median miss ×' + v.blind.median_miss_x.toFixed(2) + ', ' + (v.blind.within_3x * 100).toFixed(0) + '% inside 3×'],
    ['Category offsets', 'tested and dropped — median miss ×' + v.category_variant_loo_median_miss_x.toFixed(2) +
      ', worse than the pooled line'],
  ];
  $('fit-table').innerHTML = fitRows.map(function (r) {
    return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>';
  }).join('');
  $('cat-note').textContent = v.category_variant_note;

  var e = DATA.model.economics;
  $('econ-notes').innerHTML = [
    'Airdrop pool: ' + (e.airdrop_share * 100).toFixed(0) + '% of the implied value.',
    'Split among ' + e.qualifying_wallets.toLocaleString('en-US') + ' qualifying wallets — a scenario, not a fact.',
    'Farming cost: $' + e.setup_gas_usd + ' setup gas + $' + e.weekly_gas_usd + '/week gas + 5% a year on locked capital.',
    'Verdict: FARM at net $' + e.farm_at_net_usd + '+ per wallet, THIN at $0+, SKIP below $0.',
  ].map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');

  // ---- filter controls ----------------------------------------------------------------------
  var cats = {};
  var chains = {};
  DATA.rows.forEach(function (r) {
    if (r.category) cats[r.category] = true;
    (r.chains || []).forEach(function (ch) { chains[ch] = true; });
  });
  Object.keys(cats).sort().forEach(function (cat) {
    var o = document.createElement('option');
    o.value = cat; o.textContent = cat;
    $('category').appendChild(o);
  });
  Object.keys(chains).sort().forEach(function (ch) {
    var o = document.createElement('option');
    o.value = ch; o.textContent = ch;
    $('chain').appendChild(o);
  });

  function readHash() {
    var h = (location.hash || '').replace(/^#/, '');
    var parts = h ? h.split('&') : [];
    var next = { q: '', category: 'all', chain: 'all', verdict: 'all', watch: false, sort: 'implied', detail: null };
    parts.forEach(function (part) {
      var kv = part.split('=');
      var k = decodeURIComponent(kv[0] || '');
      var val = decodeURIComponent(kv[1] || '');
      if (k === 'q') next.q = val;
      if (k === 'cat') next.category = val;
      if (k === 'chain') next.chain = val;
      if (k === 'verdict') next.verdict = val;
      if (k === 'watch') next.watch = val === '1';
      if (k === 'sort') next.sort = val;
      if (k === 'detail') next.detail = val;
    });
    state = next;
  }
  function writeHash() {
    var parts = [];
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.category !== 'all') parts.push('cat=' + encodeURIComponent(state.category));
    if (state.chain !== 'all') parts.push('chain=' + encodeURIComponent(state.chain));
    if (state.verdict !== 'all') parts.push('verdict=' + encodeURIComponent(state.verdict));
    if (state.watch) parts.push('watch=1');
    if (state.sort !== 'implied') parts.push('sort=' + encodeURIComponent(state.sort));
    if (state.detail) parts.push('detail=' + encodeURIComponent(state.detail));
    var h = parts.length ? '#' + parts.join('&') : '';
    if (location.hash !== h) history.replaceState(null, '', h || location.pathname + location.search);
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.watch && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) === -1) return false;
      if (state.verdict !== 'all' && r.verdict !== state.verdict) return false;
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var by = {
      implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      net: function (a, b) { return b.net_per_wallet_usd - a.net_per_wallet_usd; },
      pool: function (a, b) { return b.airdrop_pool_usd - a.airdrop_pool_usd; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
      name: function (a, b) { return a.name < b.name ? -1 : 1; },
    };
    rows.sort(by[state.sort] || by.implied);
    return rows;
  }

  function verdictChip(vd) {
    return '<span class="chip chip-' + vd.toLowerCase() + '">' + vd + '</span>';
  }

  function renderBoard() {
    var rows = filtered();
    $('row-count').textContent = '(' + rows.length + ' of ' + DATA.rows.length + ')';
    $('board-body').innerHTML = rows.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong>' + (r.watchlist ? ' <span class="wl" title="On the snapshot watchlist">●</span>' : '') + '</td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(chainsText(r)) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong></td>' +
        '<td class="num">' + money(r.airdrop_pool_usd) + '</td>' +
        '<td class="num">' + signedMoney(r.net_per_wallet_usd) + '</td>' +
        '<td>' + verdictChip(r.verdict) + '</td></tr>';
    }).join('');
    $('empty').hidden = rows.length > 0;
  }

  function renderDetail() {
    var panel = $('detail');
    var row = null;
    if (state.detail) {
      for (var i = 0; i < DATA.rows.length; i++) {
        if (DATA.rows[i].slug === state.detail) { row = DATA.rows[i]; break; }
      }
    }
    if (!row) { panel.hidden = true; return; }
    panel.hidden = false;
    $('d-rank').textContent = row.rank + ' of ' + DATA.rows.length;
    $('d-cat').textContent = row.category || '—';
    $('d-name').textContent = row.name;
    var kv = [
      ['Implied value', fullMoney(row.implied_value_usd)],
      ['TVL', fullMoney(row.tvl_usd)],
      ['7-day growth', pct(row.change_7d)],
      ['Age', row.age_days === null ? 'unknown' : row.age_days + ' days'],
      ['Chains', (row.chains || []).join(', ') || '—'],
      ['Watchlist', row.watchlist ? 'yes — on the snapshot watchlist' : 'no — found by the early radar'],
    ];
    $('d-stats').innerHTML = kv.map(function (pair) {
      return '<div><dt>' + esc(pair[0]) + '</dt><dd>' + esc(pair[1]) + '</dd></div>';
    }).join('');
    var m = [
      ['Fitted base', fullMoney(row.base_value_usd) + ' — 10^(' + DATA.curve.intercept.toFixed(3) + ' + ' +
        DATA.curve.slope.toFixed(3) + ' × log10 TVL)'],
      ['Growth', '×' + row.growth_multiplier.toFixed(4) + ' — 7-day ' + pct(row.change_7d) + ', half weight'],
      ['Maturity', '×' + row.maturity_multiplier.toFixed(4) + ' — ' + ageText(row.age_days) + ' with no token'],
      ['Chains', '×' + row.chain_multiplier.toFixed(4) + ' — ' + (row.chains || []).length + ' chain(s)'],
      ['Implied value', fullMoney(row.implied_value_usd)],
    ];
    $('d-model').innerHTML = m.map(function (pair) {
      return '<tr><th>' + esc(pair[0]) + '</th><td>' + esc(pair[1]) + '</td></tr>';
    }).join('');
    var ec = [
      ['Airdrop pool', fullMoney(row.airdrop_pool_usd) + ' — 5% of implied value'],
      ['Farming cost', '$' + row.farm_cost_usd.toFixed(2) + ' — gas plus locked capital'],
      ['Net per wallet', signedMoney(row.net_per_wallet_usd) + ' — pool split among 5,000 wallets, minus cost'],
      ['Verdict', row.verdict + (row.verdict === 'FARM' ? ' — worth farming' : row.verdict === 'THIN' ? ' — marginal' : ' — not worth the cost')],
    ];
    $('d-econ').innerHTML = ec.map(function (pair) {
      return '<tr><th>' + esc(pair[0]) + '</th><td>' + esc(pair[1]) + '</td></tr>';
    }).join('');
    $('d-steps').innerHTML = (row.farm_steps || []).map(function (s) {
      return '<li>' + esc(s) + '</li>';
    }).join('');
  }

  function renderLive() {
    $('live-body').innerHTML = DATA.live.map(function (r) {
      return '<tr><td><strong>' + esc(r.name) + '</strong></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(chainsText(r)) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + money(r.mcap_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td></tr>';
    }).join('');
  }

  function renderAll() {
    $('q').value = state.q;
    $('category').value = state.category;
    $('chain').value = state.chain;
    $('verdict').value = state.verdict;
    $('watchonly').checked = state.watch;
    $('sort').value = state.sort;
    renderBoard();
    renderDetail();
  }

  // ---- events ---------------------------------------------------------------------------------
  $('q').addEventListener('input', function () { state.q = $('q').value; writeHash(); renderBoard(); });
  $('category').addEventListener('change', function () { state.category = $('category').value; writeHash(); renderBoard(); });
  $('chain').addEventListener('change', function () { state.chain = $('chain').value; writeHash(); renderBoard(); });
  $('verdict').addEventListener('change', function () { state.verdict = $('verdict').value; writeHash(); renderBoard(); });
  $('watchonly').addEventListener('change', function () { state.watch = $('watchonly').checked; writeHash(); renderBoard(); });
  $('sort').addEventListener('change', function () { state.sort = $('sort').value; writeHash(); renderBoard(); });
  $('clear').addEventListener('click', function () {
    state = { q: '', category: 'all', chain: 'all', verdict: 'all', watch: false, sort: 'implied', detail: state.detail };
    writeHash(); renderAll();
  });
  $('board-body').addEventListener('click', function (ev) {
    var tr = ev.target.closest ? ev.target.closest('tr[data-slug]') : null;
    if (!tr) return;
    state.detail = tr.getAttribute('data-slug');
    writeHash(); renderDetail();
    $('detail').scrollIntoView({ block: 'start' });
  });
  $('d-close').addEventListener('click', function () {
    state.detail = null; writeHash(); renderDetail();
  });
  window.addEventListener('hashchange', function () { readHash(); renderAll(); });

  readHash();
  renderAll();
  renderLive();
})();
