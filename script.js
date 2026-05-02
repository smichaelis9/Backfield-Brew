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
  if (!gid) throw new Error(`No GID configured for sheet: ${sheetName}`);
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
  const response = await fetch(sheetUrl(sheetName));
  if (!response.ok) throw new Error(`Failed to load ${sheetName}`);

  const text = await response.text();
  return parseCSV(text);
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some(v => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  const headers = rows.shift().map(h =>
    h.replace(/^\uFEFF/, "").trim()
  );

  return rows.map(r =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] || ""]))
  );
}

async function initRankingPage() {
  const status = document.getElementById("status");

  try {
    const players = await loadSheet("Biography Info");

    const filteredPlayers = players.filter(p => {
      const id = get(p, ["Player-ID", "Player ID", "Player Id", "PlayerID"]);
      const player = get(p, ["Player", "Name"]);

      p["Player-ID"] = id;
      p["Player"] = player;

      return id && player;
    });

    if (!filteredPlayers.length) {
      status.textContent = "No players found.";
      return;
    }

    renderRanking(filteredPlayers);
    status.textContent = "";
  } catch (err) {
    status.textContent = `Error loading data: ${err.message}`;
  }
}

function renderRanking(players) {
  document.querySelector("#rankingTable tbody").innerHTML = players
    .sort((a, b) => num(get(a, ["Rank"])) - num(get(b, ["Rank"])))
    .map(p => {
      const id = get(p, ["Player-ID", "Player ID", "Player Id", "PlayerID"]);
      const player = get(p, ["Player", "Name"]);
      const rank = get(p, ["Rank"]);
      const position = get(p, ["Position", "Pos"]);
      const level = get(p, ["Level"]);
      const age = get(p, ["Age"]);
      const ofp = get(p, ["OFP"]);
      const risk = get(p, ["Risk"]);
      const acquired = get(p, ["Acquired"]);

      return `
        <tr>
          <td>${rank}</td>
          <td><a href="player.html?id=${encodeURIComponent(id)}">${player}</a></td>
          <td>${position}</td>
          <td>${level}</td>
          <td>${age}</td>
          <td>${ofp}</td>
          <td>${risk}</td>
          <td>${acquired}</td>
        </tr>
      `;
    })
    .join("");
}
async function initPlayerPage() {
  const id = new URLSearchParams(window.location.search).get("id");
  const container = document.querySelector(".container");

  try {
    const players = await loadSheet("Biography Info");

    const bio = players.find(p => {
      const rowId = get(p, ["Player-ID", "Player ID", "Player Id", "PlayerID"]);
      return rowId === id;
    });

    if (!bio) throw new Error("Player not found");

    const playerType = get(bio, ["Player Type"]);
    const isPitcherType = playerType.toLowerCase().includes("pitch");

    const toolsSheet = isPitcherType ? "Pitcher Tools" : "Hitter Tools";
    const toolsRows = await loadSheet(toolsSheet);

    const tools = toolsRows.find(p => {
      const rowId = get(p, ["Player-ID", "Player ID", "Player Id", "PlayerID"]);
      return rowId === id;
    });

    const statSheets = isPitcherType
      ? ["Pitcher Stats 2023", "Pitcher Stats 2024", "Pitcher Stats 2025", "Pitcher Stats 2026"]
      : ["Hitter Stats 2023", "Hitter Stats 2024", "Hitter Stats 2025", "Hitter Stats 2026"];

    const stats = [];

    for (const sheet of statSheets) {
      const rows = await loadSheet(sheet);
      const row = rows.find(p => {
        const rowId = get(p, ["Player-ID", "Player ID", "Player Id", "PlayerID"]);
        return rowId === id;
      });

      if (row) {
        stats.push({
          year: sheet.match(/\d{4}/)?.[0],
          row
        });
      }
    }

    renderPlayerPage(bio, tools, stats, isPitcherType);

  } catch (err) {
    container.innerHTML = `<section class="card"><h2>Error</h2><p>${err.message}</p></section>`;
  }
}

function renderPlayerPage(bio, tools, stats, isPitcherType) {
  const player = get(bio, ["Player", "Name"]);
  const rank = get(bio, ["Rank"]);
  const position = get(bio, ["Position", "Pos"]);
  const level = get(bio, ["Level"]);
  const age = get(bio, ["Age"]);
  const ofp = get(bio, ["OFP"]);
  const risk = get(bio, ["Risk"]);
  const acquired = get(bio, ["Acquired"]);
  const height = get(bio, ["Height"]);
  const weight = get(bio, ["Weight"]);
  const batThrow = get(bio, ["Bat / Throw", "B/T"]);
  const birthday = get(bio, ["Birthday"]);
  const signedBy = get(bio, ["Signed By"]);
  const bonus = get(bio, ["Signing Bonus"]);
  const schoolCountry = get(bio, ["School / Country"]);
  const draftIFA = get(bio, ["Draft/IFA", "Draft / IFA"]);
  const picture = get(bio, ["Picture", "Image", "Photo"]);

  document.title = `${player} | Backfield Brew`;

  document.getElementById("playerHero").innerHTML = `
    <div class="player-hero-wrap">
      ${picture ? `<img class="player-photo" src="${picture}" alt="${player}">` : ""}
      <div>
        <h1>${player}</h1>
        <div class="player-meta">#${rank} | ${position} | ${level} | OFP ${ofp}</div>
      </div>
    </div>
  `;

  document.getElementById("bioCard").innerHTML = `
    <h2 class="section-title">Biography</h2>
    <div class="kv">
      <strong>Position</strong><span>${position}</span>
      <strong>Level</strong><span>${level}</span>
      <strong>Age</strong><span>${age}</span>
      <strong>Height / Weight</strong><span>${height}, ${weight}</span>
      <strong>Bat / Throw</strong><span>${batThrow}</span>
      <strong>Birthday</strong><span>${birthday}</span>
      <strong>School / Country</strong><span>${schoolCountry}</span>
      <strong>Draft / IFA</strong><span>${draftIFA}</span>
      <strong>Acquired</strong><span>${acquired}</span>
      <strong>Signed By</strong><span>${signedBy}</span>
      <strong>Signing Bonus</strong><span>${bonus}</span>
      <strong>OFP</strong><span>${ofp}</span>
      <strong>Risk</strong><span>${risk}</span>
    </div>
  `;

  renderTools(tools, isPitcherType);
  renderStats(stats, isPitcherType);
}
function renderTools(tools, isPitcherType) {
  const toolsCard = document.getElementById("toolsCard");
  if (!toolsCard) return;

  if (!tools) {
    toolsCard.innerHTML = `<h2 class="section-title">Tools</h2><p>No tools found.</p>`;
    return;
  }

  const skip = ["Player-ID", "Player ID", "Player", "Tools Updated"];

  toolsCard.innerHTML = `
    <h2 class="section-title">${isPitcherType ? "Pitcher Tools" : "Hitter Tools"}</h2>
    <div class="tool-grid">
      ${Object.entries(tools)
        .filter(([key, value]) => !skip.includes(key) && value)
        .map(([key, value]) => `
          <div class="tool-box">
            <div class="tool-label">${key}</div>
            <div class="tool-value">${value}</div>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function renderStats(stats, isPitcherType) {
  const statsCard = document.getElementById("statsCard");
  if (!statsCard) return;

  if (!stats.length) {
    statsCard.innerHTML = `<h2 class="section-title">Stats</h2><p>No stats found.</p>`;
    return;
  }

  const columns = isPitcherType
    ? ["ERA", "FIP", "xFIP", "IP", "G", "GS", "K/9", "BB/9", "K/BB", "K%", "BB%", "K-BB %", "SwStr %", "Whiff%", "WHIP", "GB%", "HR/FB"]
    : ["PA", "H", "2B", "3B", "HR", "OBP", "SLG", "OPS", "wRC+", "BABIP", "wOBA", "K%", "BB%", "SwStr %", "Whiff%", "SB", "CS", "SB%"];

  statsCard.innerHTML = `
    <h2 class="section-title">Stats</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Year</th>
            ${columns.map(col => `<th>${col}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${stats.map(season => `
            <tr>
              <td>${season.year}</td>
              ${columns.map(col => `<td>${season.row[col] || ""}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

  document.title = `${player} | Backfield Brew`;

  const hero = document.getElementById("playerHero");
  if (hero) {
    hero.innerHTML = `
      <div class="player-hero-wrap">
        ${picture ? `<img class="player-photo" src="${picture}" alt="${player}">` : ""}
        <div>
          <h1>${player}</h1>
          <div class="player-meta">#${rank} | ${position} | ${level} | OFP ${ofp}</div>
        </div>
      </div>
    `;
  }

  const bioCard = document.getElementById("bioCard");
  if (bioCard) {
    bioCard.innerHTML = `
      <h2 class="section-title">Biography</h2>
      <div class="kv">
        <strong>Position</strong><span>${position}</span>
        <strong>Level</strong><span>${level}</span>
        <strong>Age</strong><span>${age}</span>
        <strong>Height / Weight</strong><span>${height}, ${weight}</span>
        <strong>Bat / Throw</strong><span>${batThrow}</span>
        <strong>Birthday</strong><span>${birthday}</span>
        <strong>School / Country</strong><span>${schoolCountry}</span>
        <strong>Draft / IFA</strong><span>${draftIFA}</span>
        <strong>Acquired</strong><span>${acquired}</span>
        <strong>Signed By</strong><span>${signedBy}</span>
        <strong>Signing Bonus</strong><span>${bonus}</span>
        <strong>OFP</strong><span>${ofp}</span>
        <strong>Risk</strong><span>${risk}</span>
      </div>
    `;
  }
