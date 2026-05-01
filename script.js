// Published Google Sheet link supplied by you.
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

let cache = null;
let currentSort = { key: 'Rank', dir: 'asc' };

function sheetUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?output=csv&single=true&sheet=${encodeURIComponent(sheetName)}`;
}

async function loadSheet(sheetName) {
  const response = await fetch(sheetUrl(sheetName));
  if (!response.ok) throw new Error(`Could not load ${sheetName}`);
  return parseCSV(await response.text());
}

async function loadAllSheets() {
  if (cache) return cache;
  const entries = Object.entries(SHEETS);
  const loaded = await Promise.all(entries.map(async ([key, name]) => [key, await loadSheet(name)]));
  cache = Object.fromEntries(loaded);
  return cache;
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') { cell += '"'; i++; }
    else if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell.trim());
      if (row.some(v => v !== '')) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
}

function num(value) {
  const n = parseFloat(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isPitcher(player) {
  return normalize(player['Player Type']).includes('pitch') || normalize(player.Position).includes('p');
}

async function initRankingPage() {
  const status = document.getElementById('status');
  try {
    const data = await loadAllSheets();
    const players = data.bio.filter(p => p['Player-ID'] && p.Player);
    setupFilters(players);
    renderRanking(players);
    ['searchBox', 'typeFilter', 'positionFilter', 'levelFilter'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => renderRanking(players));
    });
    document.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => {
      const key = th.dataset.sort;
      currentSort = { key, dir: currentSort.key === key && currentSort.dir === 'asc' ? 'desc' : 'asc' };
      renderRanking(players);
    }));
    status.textContent = '';
  } catch (err) {
    status.textContent = `Error loading the Google Sheet. Check that every tab is published and named exactly as expected. ${err.message}`;
  }
}

function setupFilters(players) {
  fillSelect('positionFilter', [...new Set(players.map(p => p.Position).filter(Boolean))]);
  fillSelect('levelFilter', [...new Set(players.map(p => p.Level).filter(Boolean))]);
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  values.sort().forEach(v => select.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`));
}

function renderRanking(players) {
  const q = normalize(document.getElementById('searchBox').value);
  const type = document.getElementById('typeFilter').value;
  const pos = document.getElementById('positionFilter').value;
  const level = document.getElementById('levelFilter').value;

  const filtered = players.filter(p => {
    const haystack = normalize([p.Player, p.Position, p.Level, p['School / Country'], p.Acquired].join(' '));
    return (!q || haystack.includes(q)) && (!type || p['Player Type'] === type) && (!pos || p.Position === pos) && (!level || p.Level === level);
  });

  filtered.sort((a, b) => compare(a[currentSort.key], b[currentSort.key], currentSort.dir));

  document.querySelector('#rankingTable tbody').innerHTML = filtered.map(p => `
    <tr>
      <td>${escapeHtml(p.Rank)}</td>
      <td><a class="player-link" href="player.html?id=${encodeURIComponent(p['Player-ID'])}">${escapeHtml(p.Player)}</a></td>
      <td>${escapeHtml(p.Position)}</td>
      <td>${escapeHtml(p.Level)}</td>
      <td>${escapeHtml(p.Age)}</td>
      <td>${escapeHtml(p.OFP)}</td>
      <td>${escapeHtml(p.Risk)}</td>
      <td>${escapeHtml(p.Acquired)}</td>
    </tr>`).join('');
}

function compare(a, b, dir) {
  const na = num(a), nb = num(b);
  let result = na !== null && nb !== null ? na - nb : String(a || '').localeCompare(String(b || ''));
  return dir === 'asc' ? result : -result;
}

async function initPlayerPage() {
  const id = new URLSearchParams(window.location.search).get('id');
  try {
    const data = await loadAllSheets();
    const bio = data.bio.find(p => p['Player-ID'] === id);
    if (!bio) throw new Error('Player not found');
    const pitcher = isPitcher(bio);
    const tools = pitcher
      ? data.pitcherTools.find(p => p['Player-ID'] === id)
      : data.hitterTools.find(p => p['Player-ID'] === id);
    const seasons = pitcher
      ? [2023, 2024, 2025, 2026].map(y => ({ year: y, row: data[`pitcher${y}`].find(p => p['Player-ID'] === id) }))
      : [2023, 2024, 2025, 2026].map(y => ({ year: y, row: data[`hitter${y}`].find(p => p['Player-ID'] === id) }));
    renderHero(bio);
    renderBio(bio);
    renderTools(tools, pitcher);
    renderStats(seasons, pitcher);
  } catch (err) {
    document.querySelector('.container').innerHTML = `<section class="card"><h2>Player not found</h2><p>${escapeHtml(err.message)}</p></section>`;
  }
}

function renderHero(bio) {
  document.title = `${bio.Player} | Brewers Prospect Page`;
  const photo = bio.Picture ? `<img class="player-photo" src="${escapeHtml(bio.Picture)}" alt="${escapeHtml(bio.Player)}">` : '';
  document.getElementById('playerHero').innerHTML = `<div class="player-hero-wrap">${photo}<div><h1>${escapeHtml(bio.Player)}</h1><div class="player-meta">#${escapeHtml(bio.Rank)} | ${escapeHtml(bio.Position)} | ${escapeHtml(bio.Level)} | OFP ${escapeHtml(bio.OFP)}</div></div></div>`;
}

function renderBio(bio) {
  const fields = ['Player Type','School / Country','Date Signed','Signed By','Draft/IFA','Acquired','Signing Bonus','Risk','Height','Weight','Bat / Throw','Birthday','Age'];
  document.getElementById('bioCard').innerHTML = `<h2 class="section-title">Biography</h2><div class="kv">${fields.map(f => `<strong>${f}</strong><span>${escapeHtml(bio[f] || 'N/A')}</span>`).join('')}</div>`;
}

function renderTools(tools, pitcher) {
  const skip = ['Player-ID', 'Player'];
  const title = pitcher ? 'Pitcher Tools' : 'Hitter Tools';
  if (!tools) {
    document.getElementById('toolsCard').innerHTML = `<h2 class="section-title">${title}</h2><p class="empty">No tools found.</p>`;
    return;
  }
  document.getElementById('toolsCard').innerHTML = `<h2 class="section-title">${title}</h2><div class="tool-grid">${Object.entries(tools).filter(([k,v]) => !skip.includes(k) && v).map(([k,v]) => `<div class="tool-box"><div class="tool-label">${escapeHtml(k)}</div><div class="tool-value">${escapeHtml(v)}</div></div>`).join('')}</div>`;
}

function renderStats(seasons, pitcher) {
  const existing = seasons.filter(s => s.row && Object.values(s.row).some(v => v));
  if (!existing.length) {
    document.getElementById('statsCard').innerHTML = '<h2 class="section-title">Stats</h2><p class="empty">No stat lines found.</p>';
    return;
  }
  const columns = pitcher
    ? ['ERA','FIP','xFIP','IP','G','GS','K/9','BB/9','K/BB','K%','BB%','K-BB %','SwStr %','Whiff%','WHIP','GB%','HR/FB']
    : ['PA','H','2B','3B','HR','OBP','SLG','OPS','wRC+','BABIP','wOBA','K%','BB%','SwStr %','Whiff%','SB','CS','SB%'];

  document.getElementById('statsCard').innerHTML = `
    <h2 class="section-title">Stats</h2>
    <div class="table-wrap"><table><thead><tr><th>Year</th>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>
      ${existing.map(s => `<tr><td>${s.year}</td>${columns.map(c => `<td>${escapeHtml(s.row[c] || '')}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
