const PUB_ID = '2PACX-1vS7YJJLyptStf41slMLw1QW6g6gBW1rg6dlHdwFacsqlZth7lSnCKsJ5Sbtck0iw5y0ZAHDoDId9HsE';

const SHEET_GIDS = {
  "Biography Info": "536791829"
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
