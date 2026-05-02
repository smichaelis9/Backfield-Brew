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

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
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
  const table = document.querySelector("#rankingTable tbody");
  if (!table) return;

  table.innerHTML = players
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

/* =========================
   RENDER PLAYER
========================= */

function renderPlayerPage(bio, tools, stats, isPitcher) {
  const playerName = get(bio, ["Player", "Name"]);
  const picture = get(bio, ["Picture", "Image", "Photo", "Picture URL", "Image URL"]);

  setHTML("playerHero", `
    <div class="player-hero-wrap">
      ${picture
        ? `<img class="player-photo" src="${picture}" alt="${playerName}" onerror="this.style.display='none';">`
        : ""}
      <div>
        <h1>${playerName}</h1>
        <p>#${get(bio, ["Rank"])} | ${get(bio, ["Position", "Pos"])} | ${get(bio, ["Level"])}</p>
      </div>
    </div>
  `);

  setHTML("bioCard", `
    <h2>Biography</h2>
    <p><b>Age:</b> ${get(bio, ["Age"])}</p>
    <p><b>Height/Weight:</b> ${get(bio, ["Height"])}, ${get(bio, ["Weight"])}</p>
    <p><b>B/T:</b> ${get(bio, ["Bat / Throw"])}</p>
    <p><b>Signed By:</b> ${get(bio, ["Signed By"])}</p>
    <p><b>OFP:</b> ${get(bio, ["OFP"])}</p>
    <p><b>Risk:</b> ${get(bio, ["Risk"])}</p>
  `);

  renderTools(tools, isPitcher);
  renderStats(stats, isPitcher);
}

/* =========================
   TOOLS
========================= */

function isRealValue(value) {
  const v = String(value || "").trim().toLowerCase();
  return v && v !== "n/a" && v !== "na" && v !== "-";
}

function renderTools(tools, isPitcher) {
  if (!tools) {
    setHTML("toolsCard", `<h2>Tools</h2><p>No tools found.</p>`);
    return;
  }

  if (isPitcher) {
    const pitchMap = [
      ["Primary Pitch", "Pitch #1"],
      ["Secondary #1", "Pitch #2"],
      ["Secondary #2", "Pitch #3"],
      ["Secondary #3", "Pitch #4"],
      ["Secondary #4", "Pitch #5"],
      ["Secondary #5", "Pitch #6"]
    ];

    const pitchTools = pitchMap
      .map(([nameCol, gradeCol]) => {
        const pitchName = get(tools, [nameCol]);
        const grade = get(tools, [gradeCol]);

        if (!isRealValue(pitchName) || !isRealValue(grade)) return "";

        return `
          <div class="tool-box">
            <div class="tool-label">${pitchName}</div>
            <div class="tool-value">${grade}</div>
          </div>
        `;
      })
      .filter(Boolean)
      .join("");

    const extraTools = [
      ["Command", "Command"],
      ["Control", "Control"],
      ["Fastball Velocity", "Fastball Velocity"]
    ]
      .map(([label, key]) => {
        const value = get(tools, [key]);
        if (!isRealValue(value)) return "";

        return `
          <div class="tool-box">
            <div class="tool-label">${label}</div>
            <div class="tool-value">${value}</div>
          </div>
        `;
      })
      .filter(Boolean)
      .join("");

    setHTML("toolsCard", `
      <h2>Pitch Arsenal</h2>
      <div class="tool-grid">
        ${pitchTools}
        ${extraTools}
      </div>
    `);

    return;
  }

  const skip = ["Player-ID", "Player ID", "Player", "Tools Updated"];

  const hitterTools = Object.entries(tools)
    .filter(([k, v]) => !skip.includes(k) && isRealValue(v))
    .map(([k, v]) => `
      <div class="tool-box">
        <div class="tool-label">${k}</div>
        <div class="tool-value">${v}</div>
      </div>
    `)
    .join("");

  setHTML("toolsCard", `
    <h2>Tools</h2>
    <div class="tool-grid">
      ${hitterTools}
    </div>
  `);
}

  const skip = ["Player-ID", "Player ID", "Player", "Tools Updated"];

  setHTML("toolsCard", `
    <h2>Tools</h2>
    <div class="tool-grid">
      ${Object.entries(tools)
        .filter(([k, v]) => !skip.includes(k) && v)
        .map(([k, v]) => `
          <div class="tool-box">
            <div class="tool-label">${k}</div>
            <div class="tool-value">${v}</div>
          </div>
        `)
        .join("")}
    </div>
  `);
}

/* =========================
   STATS
========================= */

function renderStats(stats, isPitcher) {
  const cols = isPitcher
    ? ["ERA","FIP","xFIP","IP","G","GS","K/9","BB/9","K/BB","K%","BB%","K-BB %","SwStr %","Whiff%","WHIP"]
    : ["PA","H","2B","3B","HR","OBP","SLG","OPS","wRC+","BABIP","wOBA","K%","BB%","SwStr %","Whiff%","SB","CS","SB%"];

  setHTML("statsCard", `
    <h2>Stats</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Year</th>
            ${cols.map(c => `<th>${c}</th>`).join("")}
          </tr>
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
    </div>
  `);
}
