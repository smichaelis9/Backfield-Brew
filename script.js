const PUB_ID = '2PACX-1vS7YJJLyptStf41slMLw1QW6g6gBW1rg6dlHdwFacsqlZth7lSnCKsJ5Sbtck0iw5y0ZAHDoDId9HsE';

const SHEETS = {
  bio: 'Biography Info',
  pitcherTools: 'Pitcher Tools',
  hitterTools: 'Hitter Tools',
  hitter2023: 'Hitter Stats 2023',
  hitter2024: 'Hitter Stats 2024',
  hitter2025: 'Hitter Stats 2025',
  hitter2026: 'Hitter Stats 2026',
  pitcher2023: 'Pitcher Stats 2023',
  pitcher2024: 'Pitcher Stats 2024',
  pitcher2025: 'Pitcher Stats 2025',
  pitcher2026: 'Pitcher Stats 2026'
};

let cache = {};
let currentSort = { key: 'Rank', dir: 'asc' };

const SHEET_GIDS = {
  "Biography Info": "536791829"
};

function sheetUrl(sheetName) {
  const gid = SHEET_GIDS[sheetName];

  if (!gid) {
    throw new Error(`No GID configured for sheet: ${sheetName}`);
  }

  return `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=${gid}&single=true&output=csv`;
}

async function loadSheet(sheetName) {
  if (cache[sheetName]) return cache[sheetName];

  const response = await fetch(sheetUrl(sheetName));
  if (!response.ok) throw new Error(`Failed to load ${sheetName}`);

  const text = await response.text();
  const parsed = parseCSV(text);

  cache[sheetName] = parsed;
  return parsed;
}

function parseCSV(text) {
  const rows = text.split("\n").map(r => r.split(","));
  const headers = rows.shift();
  return rows.map(r =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] || ""]))
  );
}

function num(value) {
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isPitcher(player) {
  return normalize(player['Player Type']).includes('pitch');
}

async function initRankingPage() {
  const status = document.getElementById('status');

  try {
    const players = await loadSheet(SHEETS.bio);

    const filteredPlayers = players.filter(
      p => p['Player-ID'] && p.Player
    );

    if (!filteredPlayers.length) {
      status.textContent = 'No players found.';
      return;
    }

    renderRanking(filteredPlayers);
    status.textContent = '';

  } catch (err) {
    status.textContent = `Error loading data: ${err.message}`;
  }
}

function renderRanking(players) {
  document.querySelector('#rankingTable tbody').innerHTML = players
    .sort((a, b) => num(a.Rank) - num(b.Rank))
    .map(p => `
      <tr>
        <td>${p.Rank}</td>
        <td><a href="player.html?id=${p['Player-ID']}">${p.Player}</a></td>
        <td>${p.Position}</td>
        <td>${p.Level}</td>
        <td>${p.Age}</td>
        <td>${p.OFP}</td>
        <td>${p.Risk}</td>
        <td>${p.Acquired}</td>
      </tr>
    `).join('');
}

async function initPlayerPage() {
  const id = new URLSearchParams(window.location.search).get('id');

  try {
    const bio = (await loadSheet(SHEETS.bio)).find(p => p['Player-ID'] === id);

    if (!bio) throw new Error('Player not found');

    const pitcher = isPitcher(bio);

    const tools = pitcher
      ? await loadSheet(SHEETS.pitcherTools)
      : await loadSheet(SHEETS.hitterTools);

    const toolRow = tools.find(p => p['Player-ID'] === id);

    const statYears = [2023, 2024, 2025, 2026];

    const stats = await Promise.all(
      statYears.map(async year => {
        const sheet = pitcher ? `pitcher${year}` : `hitter${year}`;
        const rows = await loadSheet(SHEETS[sheet]);
        return {
          year,
          row: rows.find(p => p['Player-ID'] === id)
        };
      })
    );

    renderPlayerPage(bio, toolRow, stats, pitcher);

  } catch (err) {
    document.body.innerHTML = `<h2>Error: ${err.message}</h2>`;
  }
}

function renderPlayerPage(bio, tools, stats, pitcher) {
  document.getElementById('player-name').textContent = bio.Player;

  document.getElementById('player-info').innerHTML = `
    <p>${bio.Position} | ${bio.Level} | Age ${bio.Age}</p>
    <p>${bio.Height}, ${bio.Weight}</p>
    <p>OFP: ${bio.OFP} | Risk: ${bio.Risk}</p>
  `;

  document.getElementById('tools').innerHTML = tools
    ? Object.entries(tools)
        .filter(([k]) => !['Player-ID', 'Player'].includes(k))
        .map(([k, v]) => `<p><b>${k}:</b> ${v}</p>`)
        .join('')
    : 'No tools';

  document.getElementById('stats').innerHTML = stats
    .filter(s => s.row)
    .map(s => `
      <h3>${s.year}</h3>
      <pre>${JSON.stringify(s.row, null, 2)}</pre>
    `)
    .join('');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[c]));
}
