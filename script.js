const PUB_ID = '2PACX-1vS7YJJLyptStf41slMLw1QW6g6gBW1rg6dlHdwFacsqlZth7lSnCKsJ5Sbtck0iw5y0ZAHDoDId9HsE';

const SHEET_GIDS = {
  "Biography Info": "536791829",

  "Pitcher Tools": "1738771068",
  "Hitter Tools": "146410825",

  "Hitter Stats 2023": "341964968",
  "Hitter Stats 2024": "1018953464",
  "Hitter Stats 2025": "544979732",
  "Hitter Stats 2026": "1317907704",

  "Pitcher Stats 2023": "1576192112",
  "Pitcher Stats 2024": "158387021",
  "Pitcher Stats 2025": "1099458194",
  "Pitcher Stats 2026": "1603996515"
};

function sheetUrl(sheetName) {
  const gid = SHEET_GIDS[sheetName];
  if (!gid) throw new Error(`Missing GID for ${sheetName}`);
  return `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=${gid}&single=true&output=csv`;
}

function get(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") return row[key];
  }
  return "";
}

function num(value) {
  const n = parseFloat(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 999999;
}

async function loadSheet(sheetName) {
  const res = await fetch(sheetUrl(sheetName));
  if (!res.ok) throw new Error(`Failed loading ${sheetName}`);
  return parseCSV(await res.text());
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"'; i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim()); cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell.trim());
      if (row.some(v => v !== "")) rows.push(row);
      row = []; cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  const headers = rows.shift().map(h => h.replace(/^\uFEFF/, "").trim());

  return rows.map(r =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] || ""]))
  );
}

/* =========================
   RANKING PAGE
========================= */

async function initRankingPage() {
  const status = document.getElementById("status");

  try {
    const players = await loadSheet("Biography Info");

    const clean = players.filter(p => {
      const id = get(p, ["Player-ID", "Player ID"]);
      const name = get(p, ["Player", "Name"]);
      p["Player-ID"] = id;
      p["Player"] = name;
      return id && name;
    });

    renderRanking(clean);
    status.textContent = "";

  } catch (err) {
    status.textContent = err.message;
  }
}

function renderRanking(players) {
  document.querySelector("#rankingTable tbody").innerHTML = players
    .sort((a, b) => num(get(a, ["Rank"])) - num(get(b, ["Rank"])))
    .map(p => `
      <tr>
        <td>${get(p, ["Rank"])}</td>
        <td><a href="player.html?id=${encodeURIComponent(get(p, ["Player-ID"]))}">${get(p, ["Player"])}</a></td>
        <td>${get(p, ["Position", "Pos"])}</td>
        <td>${get(p, ["Level"])}</td>
        <td>${get(p, ["Age"])}</td>
        <td>${get(p, ["OFP"])}</td>
        <td>${get(p, ["Risk"])}</td>
        <td>${get(p, ["Acquired"])}</td>
      </tr>
    `).join("");
}

/* =========================
   PLAYER PAGE
========================= */

async function initPlayerPage() {
  const id = new URLSearchParams(window.location.search).get("id");

  try {
    const players = await loadSheet("Biography Info");

    const bio = players.find(p =>
      get(p, ["Player-ID", "Player ID"]) === id
    );

    if (!bio) throw new Error("Player not found");

    const isPitcher = get(bio, ["Player Type"]).toLowerCase().includes("pitch");

    const toolsSheet = isPitcher ? "Pitcher Tools" : "Hitter Tools";
    const toolsRows = await loadSheet(toolsSheet);

    const tools = toolsRows.find(p =>
      get(p, ["Player-ID", "Player ID"]) === id
    );

    const statSheets = isPitcher
      ? ["Pitcher Stats 2023", "Pitcher Stats 2024", "Pitcher Stats 2025", "Pitcher Stats 2026"]
      : ["Hitter Stats 2023", "Hitter Stats 2024", "Hitter Stats 2025", "Hitter Stats 2026"];

    const stats = [];

    for (const sheet of statSheets) {
      const rows = await loadSheet(sheet);
      const row = rows.find(p =>
        get(p, ["Player-ID", "Player ID"]) === id
      );

      if (row) {
        stats.push({
          year: sheet.match(/\d{4}/)[0],
          row
        });
      }
    }

    renderPlayerPage(bio, tools, stats, isPitcher);

  } catch (err) {
    document.body.innerHTML = `<h2>${err.message}</h2>`;
  }
}

function renderPlayerPage(bio, tools, stats, isPitcher) {
  document.getElementById("playerHero").innerHTML = `
    <h1>${get(bio, ["Player"])}</h1>
    <p>#${get(bio, ["Rank"])} | ${get(bio, ["Position", "Pos"])} | ${get(bio, ["Level"])}</p>
  `;

  document.getElementById("bioCard").innerHTML = `
    <h2>Biography</h2>
    <p><b>Age:</b> ${get(bio, ["Age"])}</p>
    <p><b>Height/Weight:</b> ${get(bio, ["Height"])}, ${get(bio, ["Weight"])}</p>
    <p><b>B/T:</b> ${get(bio, ["Bat / Throw"])}</p>
    <p><b>Signed By:</b> ${get(bio, ["Signed By"])}</p>
    <p><b>OFP:</b> ${get(bio, ["OFP"])}</p>
    <p><b>Risk:</b> ${get(bio, ["Risk"])}</p>
  `;

  renderTools(tools);
  renderStats(stats, isPitcher);
}

/* =========================
   TOOLS
========================= */

function renderTools(tools) {
  const skip = ["Player-ID", "Player", "Tools Updated"];

  document.getElementById("toolsCard").innerHTML = `
    <h2>Tools</h2>
    <div class="tool-grid">
      ${Object.entries(tools || {})
        .filter(([k, v]) => !skip.includes(k) && v)
        .map(([k, v]) => `<div><b>${k}:</b> ${v}</div>`)
        .join("")}
    </div>
  `;
}

/* =========================
   STATS
========================= */

function renderStats(stats, isPitcher) {
  const cols = isPitcher
    ? ["ERA","FIP","IP","K/9","BB/9","WHIP"]
    : ["PA","H","HR","OPS","wRC+","K%","BB%"];

  document.getElementById("statsCard").innerHTML = `
    <h2>Stats</h2>
    <table>
      <thead>
        <tr><th>Year</th>${cols.map(c => `<th>${c}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${stats.map(s => `
          <tr>
            <td>${s.year}</td>
            ${cols.map(c => `<td>${s.row[c] || ""}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}
