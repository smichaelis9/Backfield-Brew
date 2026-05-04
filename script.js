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
  "Pitcher Stats 2026": "1603996515",
  "Videos": "1306695134"
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

function isRealValue(value) {
  const v = String(value || "").trim().toLowerCase();
  return v && v !== "n/a" && v !== "na" && v !== "-";
}

function num(value) {
  const n = parseFloat(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 999999;
}

const sheetCache = {};

async function loadSheet(sheetName) {
  if (sheetCache[sheetName]) return sheetCache[sheetName];

  const res = await fetch(sheetUrl(sheetName));
  if (!res.ok) throw new Error(`Failed loading ${sheetName}`);

  const text = await res.text();
  const rows = parseCSV(text);

  sheetCache[sheetName] = rows;
  return rows;
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];

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

    setupFilters(clean);
    attachFilterListeners(clean);
    renderRanking(clean);

    status.textContent = "";
  } catch (err) {
    status.textContent = err.message;
  }
}

function setupFilters(players) {
  const positionFilter = document.getElementById("positionFilter");
  const levelFilter = document.getElementById("levelFilter");

  if (positionFilter) {
    const positions = new Set();

    players.forEach(p => {
      const pos = get(p, ["Position", "Pos"]);
      pos.split(/[\/, ]+/).forEach(part => {
        if (part.trim()) positions.add(part.trim());
      });
    });

    positionFilter.innerHTML =
      `<option value="">All Positions</option>` +
      [...positions].sort().map(pos => `<option value="${pos}">${pos}</option>`).join("");
  }

  if (levelFilter) {
    const levels = new Set();

    players.forEach(p => {
      const level = get(p, ["Level"]);
      if (level) levels.add(level);
    });

    levelFilter.innerHTML =
      `<option value="">All Levels</option>` +
      [...levels].sort().map(level => `<option value="${level}">${level}</option>`).join("");
  }
}

function attachFilterListeners(players) {
  ["searchBox", "typeFilter", "positionFilter", "levelFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => renderRanking(players));
      el.addEventListener("change", () => renderRanking(players));
    }
  });
}

function renderRanking(players) {
  const table = document.querySelector("#rankingTable tbody");
  if (!table) return;

  const search = String(document.getElementById("searchBox")?.value || "").toLowerCase().trim();
  const type = document.getElementById("typeFilter")?.value || "";
  const posFilter = document.getElementById("positionFilter")?.value || "";
  const levelFilter = document.getElementById("levelFilter")?.value || "";

  const filtered = players.filter(p => {
    const name = get(p, ["Player", "Name"]).toLowerCase();
    const playerType = get(p, ["Player Type"]).toLowerCase();
    const positionParts = get(p, ["Position", "Pos"])
      .split(/[\/, ]+/)
      .map(x => x.trim())
      .filter(Boolean);
    const level = get(p, ["Level"]);

    return (
      (!search || name.includes(search)) &&
      (!type || playerType === type.toLowerCase()) &&
      (!posFilter || positionParts.includes(posFilter)) &&
      (!levelFilter || level === levelFilter)
    );
  });

  table.innerHTML = filtered
    .sort((a, b) => num(get(a, ["Rank"])) - num(get(b, ["Rank"])))
    .map(p => `
    <tr>
      <td>${get(p, ["Rank"])}</td>
      <td><a href="player.html?id=${encodeURIComponent(get(p, ["Player-ID"]))}">${get(p, ["Player"])}</a></td>
      <td>${get(p, ["OFP"])}</td>
      <td>${get(p, ["Risk"])}</td>
      <td>${renderTrending(get(p, ["Trending"]))}</td>
      <td>${get(p, ["Position", "Pos"])}</td>
      <td>${get(p, ["Level"])}</td>
      <td>${get(p, ["Age"])}</td>
      <td>${get(p, ["Height"])}</td>
      <td>${get(p, ["Weight"])}</td>
    </tr>
  `).join("");
}
function renderTrending(value) {
  const v = String(value || "").toLowerCase().trim();

  if (v === "up") {
    return `<span class="trend up">▲</span>`;
  }

  if (v === "down") {
    return `<span class="trend down">▼</span>`;
  }

  if (v === "new") {
    return `<span class="trend new">NEW</span>`;
  }

  return "";
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

const statSheets = isPitcher
  ? ["Pitcher Stats 2023", "Pitcher Stats 2024", "Pitcher Stats 2025", "Pitcher Stats 2026"]
  : ["Hitter Stats 2023", "Hitter Stats 2024", "Hitter Stats 2025", "Hitter Stats 2026"];

const [toolsRows, videoRows, ...statRowsByYear] = await Promise.all([
  loadSheet(toolsSheet),
  loadSheet("Videos").catch(() => []),
  ...statSheets.map(sheet => loadSheet(sheet))
]);

const tools = toolsRows.find(p =>
  get(p, ["Player-ID", "Player ID"]) === id
);

const stats = statRowsByYear
  .map((rows, index) => {
    const row = rows.find(p =>
      get(p, ["Player-ID", "Player ID"]) === id
    );

    if (!row) return null;

    const dataKeys = Object.keys(row).filter(k =>
      !["Player-ID", "Player ID", "Player"].includes(k)
    );

    const hasRealStats = dataKeys.some(k => isRealValue(row[k]));

    if (!hasRealStats) return null;

    return {
      year: statSheets[index].match(/\d{4}/)[0],
      row
    };
  })
  .filter(Boolean);

const videos = videoRows.filter(v =>
  get(v, ["Player-ID", "Player ID"]) === id
);

renderPlayerPage(bio, tools, stats, isPitcher, videos);
  } catch (err) {
    document.body.innerHTML = `<h2>${err.message}</h2>`;
  }
}

/* =========================
   RENDER PLAYER
========================= */

function renderPlayerPage(bio, tools, stats, isPitcher, videos) {
  const playerName = get(bio, ["Player", "Name"]);
  const picture = get(bio, ["Picture", "Image", "Photo", "Picture URL", "Image URL"]);
  const ofp = get(bio, ["OFP"]);
  const risk = get(bio, ["Risk"]);

  setHTML("playerHero", `
    <div class="player-hero-wrap">
      ${isRealValue(picture)
  ? `
    <div class="player-image-wrap">
      <img class="player-photo" src="${picture}" alt="${playerName}" onerror="this.style.display='none';">
      ${isRealValue(get(bio, ["Picture source", "Picture Source"]))
        ? `<div class="image-source">Source: ${get(bio, ["Picture source", "Picture Source"])}</div>`
        : ""}
    </div>
  `
  : ""}
      <div class="player-main-info">
  <div class="player-trending-above-name">
    ${renderTrending(get(bio, ["Trending", "Trend", "Movement"]))}
  </div>

  <h1>
    <span class="player-rank">#${get(bio, ["Rank"])}</span>
    <span class="player-name">${playerName}</span>
  </h1>

  <p>${get(bio, ["Position", "Pos"])} | ${get(bio, ["Level"])}</p>
</div>

      <div class="player-grade-box">
        ${isRealValue(ofp) ? `
          <div>
            <span class="grade-label">OFP</span>
            <span class="grade-value">${ofp}</span>
          </div>
        ` : ""}
        ${isRealValue(risk) ? `
          <div>
            <span class="grade-label">Risk</span>
            <span class="grade-value">${risk}</span>
          </div>
        ` : ""}
      </div>
    </div>
  `);

  setHTML("bioCard", `
    <h2>Bio</h2>
    <p><b>Birthday:</b> ${get(bio, ["Birthday", "DOB"])}</p>
    <p><b>Age:</b> ${get(bio, ["Age"])}</p>
    <p><b>Height:</b> ${get(bio, ["Height"])}</p>
    <p><b>Weight:</b> ${get(bio, ["Weight"])}</p>
    <p><b>Bat / Throw:</b> ${get(bio, ["Bat / Throw", "B/T"])}</p>
    <p><b>Draft/IFA:</b> ${get(bio, ["Draft/IFA", "Draft / IFA"])}</p>
    <p><b>Acquired:</b> ${get(bio, ["Acquired"])}</p>
    <p><b>Signed By:</b> ${get(bio, ["Signed By"])}</p>
    <p><b>Rule 5 Eligible:</b> ${get(bio, ["Rule 5 Eligible", "Rule5 Eligible"])}</p>
  `);

  renderExternalLinks(bio);
  renderTools(tools, isPitcher);
  renderScoutingNotes(bio);
  renderArticles(bio);
  renderStats(stats, isPitcher);
  renderVideos(videos);
}

/* =========================
   TOOLS
========================= */

function renderTools(tools, isPitcher) {
  if (!tools) {
    setHTML("toolsCard", `<h2>Tools</h2><p>No tools found.</p>`);
    return;
  }

  if (isPitcher) {
    const pitchMap = [
      [["Primary Pitch"], ["Pitch #1", "Pitch#1"]],
      [["Secondary #1"], ["Pitch #2", "Pitch#2"]],
      [["Secondary #2"], ["Pitch #3", "Pitch#3"]],
      [["Secondary #3"], ["Pitch #4", "Pitch#4"]],
      [["Secondary #4"], ["Pitch #5", "Pitch#5"]],
      [["Secondary #5"], ["Pitch #6", "Pitch#6"]]
    ];

    const pitchTools = pitchMap
      .map(([nameCols, gradeCols]) => {
        const pitchName = get(tools, nameCols);
        const grade = get(tools, gradeCols);

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

    const lastUpdated = get(tools, ["Last Updated", "Tools Updated"]);

    setHTML("toolsCard", `
      <h2>
        Pitch Arsenal
        ${isRealValue(lastUpdated) ? `<span class="tools-updated">(Last Updated: ${lastUpdated})</span>` : ""}
      </h2>
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

  const lastUpdated = get(tools, ["Last Updated", "Tools Updated"]);

    setHTML("toolsCard", `
      <h2>
        Tool Grades
        ${isRealValue(lastUpdated) ? `<span class="tools-updated">(Last Updated: ${lastUpdated})</span>` : ""}
      </h2>
      <div class="tool-grid">
        ${hitterTools || "<p>No tools found.</p>"}
      </div>
    `);
}

/* =========================
   SCOUTING NOTES
========================= */

function renderScoutingNotes(bio) {
  const notes = get(bio, ["Scouting Notes", "Notes"]);

  if (!isRealValue(notes)) return;

  const statsCard = document.getElementById("statsCard");

  const noteItems = notes
    .split(/\n|•|- /)
    .map(item => item.trim())
    .filter(item => isRealValue(item));

  if (!noteItems.length) return;

  if (statsCard) {
    statsCard.insertAdjacentHTML("beforebegin", `
      <section class="card" data-access="premium">
        <h2>
        Scouting Notes
          ${isRealValue(get(bio, ["Notes Updated"]))
            ? `<span class="tools-updated">(Last Updated: ${get(bio, ["Notes Updated"])})</span>`
            : ""}
        </h2>
        <ul class="scouting-notes">
          ${noteItems.map(item => `<li>${item}</li>`).join("")}
        </ul>
      </section>
    `);
  }
}
/* =========================
   ARTICLES
========================= */
function renderArticles(bio) {
  const articles = [];

  for (let i = 1; i <= 10; i++) {
    const label = get(bio, [`Article ${i}`]);
    const url = cleanUrl(get(bio, [`Article ${i} Link`, `Article Link ${i}`]));

    if (isRealValue(url)) {
      articles.push({
        label: isRealValue(label) ? label : `Article ${i}`,
        url
      });
    }
  }

  if (!articles.length) return;

  const statsCard = document.getElementById("statsCard");

  if (statsCard) {
    statsCard.insertAdjacentHTML("beforebegin", `
      <section class="card" data-access="premium">
        <h2>Articles</h2>
        <div class="article-links-grid">
          ${articles.map(article => `
            <a class="article-link-card" href="${article.url}" target="_blank" rel="noopener noreferrer">
              ${article.label}
            </a>
          `).join("")}
        </div>
      </section>
    `);
  }
}
/* =========================
   STATS
========================= */

function renderStats(stats, isPitcher) {
  if (!stats.length) {
    setHTML("statsCard", `<h2>Stats</h2><p>No stats available.</p>`);
    return;
  }

  const standardCols = isPitcher
    ? ["ERA","FIP","xFIP","IP","G","GS","CG","ShO","SV","BS","K/9","BB/9","K/BB","HR/9","WHIP"]
    : ["PA","H","2B","3B","HR","OBP","SLG","OPS","SB","CS","SB%"];

  const advancedCols = isPitcher
    ? ["K%","BB%","K-BB %","SwStr %","Whiff%","BABIP","LOB %","LD%","GB%","FB%","IFFB %","HR/FB"]
    : ["wRC+","BABIP","wOBA","K%","BB%","SwStr %","Whiff%","PULL %","CENT %","OPPO %","LD%","GB%","FB%","IFFB %"];

  function buildTable(title, cols) {
    return `
      <h3>${title}</h3>
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
                ${cols.map(c => `<td>${isRealValue(s.row[c]) ? s.row[c] : ""}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  setHTML("statsCard", `
    <h2>Stats</h2>
    ${buildTable("Standard Stats", standardCols)}
    ${buildTable("Advanced / Batted Ball Stats", advancedCols)}
  `);
}
/* =========================
   VIDEOS
========================= */

function renderVideos(videos) {
  const expandedVideos = [];

  (videos || []).forEach(row => {
    for (let i = 1; i <= 75; i++) {
      const label = get(row, [`Video ${i}`, `Video Label ${i}`, `Label ${i}`]);
      const url = get(row, [`Video Link ${i}`, `Video URL ${i}`, `Link ${i}`]);

      if (isRealValue(url)) {
        expandedVideos.push({
          label: isRealValue(label) ? label : `Video ${i}`,
          url
        });
      }
    }
  });

  if (!expandedVideos.length) return;

  const videoHTML = expandedVideos.map(v => `
    <a class="video-card-link" href="${v.url}" target="_blank" rel="noopener">
      ${v.label}
    </a>
  `).join("");

  const container = document.querySelector(".container");

  if (container) {
    container.insertAdjacentHTML("beforeend", `
      <section class="card" data-access="premium">
        <h2>Videos</h2>
        <div class="video-grid">
          ${videoHTML}
        </div>
      </section>
    `);
  }
}
function handleHeaderButtons() {
  const backBtn = document.getElementById("backToRankings");

  if (!backBtn) return;

  if (window.location.pathname.includes("player.html")) {
    backBtn.style.display = "inline-block";
  } else {
    backBtn.style.display = "none";
  }
}
function cleanUrl(url) {
  const value = String(url || "").trim();

  if (!isRealValue(value)) return "";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://${value}`;
}

function renderExternalLinks(bio) {
  const socials = [
    {
      platform: "x",
      label: get(bio, ["Twitter/X", "Twitter", "X"]),
      url: cleanUrl(get(bio, ["Twitter/X Link", "Twitter Link", "X Link"]))
    },
    {
      platform: "instagram",
      label: get(bio, ["Instagram"]),
      url: cleanUrl(get(bio, ["Instagram Link"]))
    },
    {
      platform: "tiktok",
      label: get(bio, ["Other Social", "TikTok"]),
      url: cleanUrl(get(bio, ["Other Social Link", "TikTok Link"]))
    }
  ].filter(s => isRealValue(s.url));

  const externalLinks = [
    { label: "Baseball Reference", keys: ["Baseball Reference", "BBRef"] },
    { label: "FanGraphs", keys: ["FanGraphs", "Fangraphs"] },
    { label: "Baseball America", keys: ["Baseball America"] },
    { label: "MiLB", keys: ["MiLB", "MILB"] },
    { label: "Baseball Prospectus", keys: ["Baseball Prospectus"] }
  ];

  const socialHTML = socials.map(s => `
    <a href="${s.url}" target="_blank" rel="noopener noreferrer"
       class="social-link-card ${s.platform}"
       title="${s.label || s.platform}">
      ${getSocialIcon(s.platform)}
    </a>
  `).join("");

  const externalHTML = externalLinks
    .map(link => {
      const url = cleanUrl(get(bio, link.keys));
      if (!url) return "";

      return `
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="external-link-card">
          ${link.label}
        </a>
      `;
    })
    .filter(Boolean)
    .join("");

  if (!socialHTML && !externalHTML) return;

  const hero = document.getElementById("playerHero");

  if (hero) {
    hero.insertAdjacentHTML("afterend", `
      <section class="card links-card">
        ${socialHTML ? `<div class="social-links-row">${socialHTML}</div>` : ""}
        ${externalHTML ? `<div class="external-links-grid">${externalHTML}</div>` : ""}
      </section>
    `);
  }
}

function getSocialIcon(platform) {
  if (platform === "x") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18.9 2h3.3l-7.2 8.2L23.5 22h-6.7l-5.2-6.8L5.6 22H2.3l7.7-8.8L1.8 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.8L7.6 3.9H5.7L17.7 20Z"/>
      </svg>
    `;
  }

  if (platform === "instagram") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 4.5A3.5 3.5 0 1 1 12 15.5 3.5 3.5 0 0 1 12 8.5Zm0 2A1.5 1.5 0 1 0 12 13.5 1.5 1.5 0 0 0 12 10.5ZM17.8 6.4a.8.8 0 1 1-.8.8.8.8 0 0 1 .8-.8Z"/>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.6 5.8c-1.1-.8-1.8-2.1-1.8-3.6h-3.2v13.1a2.6 2.6 0 1 1-2.6-2.6c.3 0 .6.1.9.2V9.6a6.1 6.1 0 0 0-.9-.1A5.8 5.8 0 1 0 14.8 15V8.4a7.1 7.1 0 0 0 4.2 1.4V6.6a4.1 4.1 0 0 1-2.4-.8Z"/>
    </svg>
  `;
}
