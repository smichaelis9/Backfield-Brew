/* =========================
   LOCAL JSON DATA FILES
========================= */

const DATA_FILES = {

  "Biography Info":
    "data/biography.json",

  "Archived Biography Info":
    "data/archived-biography.json",

  "Pitcher Tools":
    "data/pitcher-tools.json",

  "Hitter Tools":
    "data/hitter-tools.json",

  "Hitter Stats 2023":
    "data/hitter-stats-2023.json",

  "Hitter Stats 2024":
    "data/hitter-stats-2024.json",

  "Hitter Stats 2025":
    "data/hitter-stats-2025.json",

  "Hitter Stats 2026":
    "data/hitter-stats-2026.json",

  "Pitcher Stats 2023":
    "data/pitcher-stats-2023.json",

  "Pitcher Stats 2024":
    "data/pitcher-stats-2024.json",

  "Pitcher Stats 2025":
    "data/pitcher-stats-2025.json",

  "Pitcher Stats 2026":
    "data/pitcher-stats-2026.json",

  "Videos":
    "data/videos.json",

  "Draft History":
    "data/draft-history.json",

  "International Signing History":
    "data/international-history.json",

  "Rule 5 Eligibility":
    "data/rule5.json",

  "MiLB Free Agency":
    "data/free-agency.json",

  "MiLB Depth Chart":
    "data/depth-chart.json",

  "Transactions":
    "data/transactions.json"

};

let currentPlayerExportData = null;

/* =========================
   HELPERS
========================= */

function get(row, keys) {

  for (const key of keys) {

    if (
      row[key] !== undefined &&
      row[key] !== ""
    ) {
      return row[key];
    }
  }

  return "";
}


function isRealValue(value) {

  const v =
    String(value || "")
      .trim()
      .toLowerCase();

  return (
    v &&
    v !== "n/a" &&
    v !== "na" &&
    v !== "-"
  );
}


function num(value) {

  const n =
    parseFloat(
      String(value || "")
        .replace(
          /[^0-9.-]/g,
          ""
        )
    );

  return Number.isFinite(n)
    ? n
    : 999999;
}


/* =========================
   DATA CACHE
========================= */

const sheetCache = {};


/* =========================
   LOAD LOCAL JSON
========================= */

async function loadSheet(
  sheetName
) {

  if (
    sheetCache[sheetName]
  ) {
    return sheetCache[
      sheetName
    ];
  }


  const file =
    DATA_FILES[
      sheetName
    ];


  if (!file) {

    throw new Error(
      `Missing data file for ${sheetName}`
    );
  }


  const response =
    await fetch(file);


  if (!response.ok) {

    throw new Error(
      `Failed loading ${sheetName}`
    );
  }


  const rows =
    await response.json();


  if (
    !Array.isArray(rows)
  ) {

    throw new Error(
      `Invalid data for ${sheetName}`
    );
  }


  sheetCache[sheetName] =
    rows;


  return rows;
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function formatLogDate(value) {

  if (String(value).includes("/"))
    return value;

  const n = Number(value);

  if (!Number.isFinite(n))
    return value;

  const date = new Date(
    (n - 25569) * 86400 * 1000
  );

  return `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}`;
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
      <td>
        <a class="ranking-player-link" href="player.html?id=${encodeURIComponent(get(p, ["Player-ID"]))}">
          ${isRealValue(get(p, ["Picture", "Image", "Photo", "Picture URL", "Image URL"]))
            ? `
              <img
                class="ranking-player-photo"
                src="${get(p, ["Picture", "Image", "Photo", "Picture URL", "Image URL"])}"
                alt="${get(p, ["Player"])}"
                loading="lazy"
                decoding="async"
                onerror="this.style.display='none';"
              >
            `
            : ""}
          <span>${get(p, ["Player"])}</span>
        </a>
      </td>
      <td>${get(p, ["OFP"])}</td>
      <td>${get(p, ["Risk"])}</td>
      <td>
        ${renderRankMovement(
          get(p, ["Rank"]),
          get(p, ["Previous Rank"])
        )}
      </td>
      <td>${get(p, ["Position", "Pos"])}</td>
      <td>${get(p, ["Level"])}</td>
      <td>${get(p, ["Age"])}</td>
      <td>${get(p, ["Height"])}</td>
      <td>${get(p, ["Weight"])}</td>
    </tr>
  `).join("");
}
function renderRankMovement(
  currentRank,
  previousRank
) {

  const current =
    Number(currentRank);

  const previous =
    Number(previousRank);


  /* No current rank */
  if (
    !Number.isFinite(current)
  ) {
    return "";
  }


  /* No previous ranking = NEW */
  if (
    previousRank === "" ||
    previousRank === null ||
    previousRank === undefined ||
    !Number.isFinite(previous)
  ) {

    return `
      <span
        class="trend new"
        title="New to rankings"
      >
        NEW
      </span>
    `;
  }


  const change =
    previous - current;


  /* Moved up */
  if (change > 0) {

    return `
      <span
        class="trend up"
        title="Previously ranked #${previous}"
      >
        ▲ ${change}
      </span>
    `;
  }


  /* Moved down */
  if (change < 0) {

    return `
      <span
        class="trend down"
        title="Previously ranked #${previous}"
      >
        ▼ ${Math.abs(change)}
      </span>
    `;
  }


  /* No movement */
  return `
    <span
      class="trend same"
      title="Previously ranked #${previous}"
    >
      —
    </span>
  `;
}
/* =========================
   PLAYER PAGE
========================= */
async function initPlayerPage() {

  const id =
    new URLSearchParams(
      window.location.search
    ).get("id");


  if (!id) {

    document.body.innerHTML =
      "<h2>Player not found</h2>";

    return;
  }


  try {

    /* =========================
       MATCH THE FILE NAME USED
       BY export-sheets.mjs
    ========================= */

    const safeID =
      String(id)
        .trim()
        .replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );


    const response =
      await fetch(
        `data/players/${safeID}.json`
      );


    if (!response.ok) {

      throw new Error(
        "Player data not found"
      );
    }


    const playerData =
      await response.json();


    /* =========================
       PLAYER DATA
    ========================= */

    const bio =
      playerData.bio || {};


    const tools =
      playerData.tools || null;


    const videos =
      Array.isArray(
        playerData.videos
      )
        ? playerData.videos
        : [];


    const isPitcher =
      String(
        playerData.playerType ||
        get(
          bio,
          ["Player Type"]
        )
      )
        .toLowerCase()
        .includes("pitch");


    /* =========================
       CONVERT STATS OBJECT
       TO EXISTING PAGE FORMAT

       JSON:
       {
         "2024": {...},
         "2025": {...},
         "2026": {...}
       }

       Existing renderer expects:
       [
         { year: "2024", row: {...} },
         ...
       ]
    ========================= */

    const stats =
      Object.entries(
        playerData.stats || {}
      )
        .map(
          ([year, row]) => {

            if (
              !row ||
              typeof row !== "object"
            ) {
              return null;
            }


            /* =========================
               CHECK FOR ACTUAL STATS
            ========================= */

            const ignoreFields = new Set([
              "Player-ID",
              "Player ID",
              "Player",
              "PlayerName",
              "Player Name",
              "Name",
              "Archived?",
              "Team",
              "Level",
              "Age",
              "Season",
              "Year"
            ]);


            const hasRealStats =
              Object.entries(row)
                .some(([key, value]) => {

                  if (
                    ignoreFields.has(key)
                  ) {
                    return false;
                  }


                  const cleaned =
                    String(value ?? "")
                      .trim();


                  return (
                    cleaned !== "" &&
                    cleaned.toLowerCase() !== "n/a" &&
                    cleaned.toLowerCase() !== "na" &&
                    cleaned !== "-"
                  );
                });


            if (!hasRealStats) {
              return null;
            }


            return {
              year,
              row
            };
          }
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            Number(a.year) -
            Number(b.year)
        );


    /* =========================
       RENDER ONCE
    ========================= */
     
    currentPlayerExportData = {
     bio,
     tools,
     stats,
     isPitcher,
     videos
   };
     renderPlayerPage(
      bio,
      tools,
      stats,
      isPitcher,
      videos
    );
     
   setupPlayerCardExport();

  } catch (err) {

    console.error(
      "Player page:",
      err
    );


    document.body.innerHTML =
      `<h2>${err.message}</h2>`;

  }
}
/* =========================
   RENDER PLAYER
========================= */

function renderPlayerPage(
  bio,
  tools,
  stats,
  isPitcher,
  videos,
  isArchive = false,
  deferLowerSections = false
) {
  const playerName = get(bio, ["Player", "Name"]);
  const picture = get(bio, ["Picture", "Image", "Photo", "Picture URL", "Image URL"]);
  const ofp = get(bio, ["OFP"]);
  const risk = get(bio, ["Risk"]);
  const birthday = get(bio, ["Birthday"]);
  const age = get(bio, ["Age"]);
  const height = get(bio, ["Height"]);
  const weight = get(bio, ["Weight"]);
  const batThrow = get(bio, ["Bat / Throw", "Bat/Throw"]);
  const draft = get(bio, ["Draft/IFA"]);
  const acquired = get(bio, ["Acquired"]);
  const signedBy = get(bio, ["Signed By", "Signed"]);
  const rule5 = get(bio, ["Rule 5 Eligible"]);
  
  setHTML("playerHero", `
    <div class="player-hero-wrap">
      ${isRealValue(picture)
  ? `
    <div class="player-image-wrap">
      <img
        class="player-photo"
        src="${picture}"
        alt="${playerName}"
        decoding="async"
        fetchpriority="high"
        onerror="this.style.display='none';"
      >
      ${isRealValue(get(bio, ["Picture source", "Picture Source"]))
        ? `<div class="image-source">Source: ${get(bio, ["Picture source", "Picture Source"])}</div>`
        : ""}
    </div>
  `
  : ""}
      <div class="player-main-info">
  <div class="player-trending-above-name">
    ${renderRankMovement(
      get(bio, ["Rank"]),
      get(bio, ["Previous Rank"])
    )}
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

  ${isRealValue(birthday) ? `<p><strong>Birthday:</strong> ${birthday}</p>` : ""}
  ${isRealValue(age) ? `<p><strong>Age:</strong> ${age}</p>` : ""}
  ${isRealValue(height) ? `<p><strong>Height:</strong> ${height}</p>` : ""}
  ${isRealValue(weight) ? `<p><strong>Weight:</strong> ${weight}</p>` : ""}
  ${isRealValue(batThrow) ? `<p><strong>Bat / Throw:</strong> ${batThrow}</p>` : ""}
  ${isRealValue(get(bio, ["School/Country"])) ? `
  <p>
    <strong>${get(bio, ["School or Country"])}:</strong>
    ${get(bio, ["School/Country"])}
  </p>
` : ""}
  ${isRealValue(draft) ? `<p><strong>Draft/IFA:</strong> ${draft}</p>` : ""}
  ${isRealValue(acquired) ? `<p><strong>Acquired:</strong> ${acquired}</p>` : ""}
  ${isRealValue(get(bio, ["Signing Bonus", "Bonus"])) ? `<p><strong>Signing Bonus:</strong> ${get(bio, ["Signing Bonus", "Bonus"])}</p>` : ""}
  ${isRealValue(signedBy) ? `<p><strong>Signed By:</strong> ${signedBy}</p>` : ""}

  ${!isArchive && isRealValue(rule5)
    ? `<p><strong>Rule 5 Eligible:</strong> ${rule5}</p>`
    : ""}
`);

  renderExternalLinks(bio);

renderTools(
  tools,
  isPitcher
);

renderFullScoutingReport(
  bio,
  isPitcher
);

renderScoutingNotes(
  bio
);

renderArticles(
  bio
);


/* =========================
   STATS / VIDEOS
========================= */

if (deferLowerSections) {

  setHTML(
    "statsCard",
    `
      <h2>
        Stats
      </h2>

      <p class="player-section-loading">
        Loading stats...
      </p>
    `
  );

} else {

  renderStats(
    stats,
    isPitcher
  );


  renderVideos(
    videos
  );
}


/* =========================
   TRANSACTIONS

   Already loads asynchronously,
   so it does not need to block
   the player page.
========================= */

renderTransactions(
  bio
);
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
      [["Secondary #5"], ["Pitch #6", "Pitch#6"]],
      [["Secondary #6"], ["Pitch #7", "Pitch#7"]]
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

  const skip = [
  "Player-ID",
  "Player ID",
  "Player",
  "Tools Updated",
  "Last Updated"
];

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
   SCOUTING REPORTS FULL
========================= */

function renderFullScoutingReport(bio, isPitcher) {
  const fullUpdated = get(bio, ["Full Report Updated"]);
  const playerName = get(bio, ["Player", "Name"]);

  const sections = [];

  const addSection = (title, text) => {
    if (isRealValue(text)) {
      sections.push({ title, text });
    }
  };

  addSection("Physical Description", get(bio, ["Physical Description Report"]));

  if (isPitcher) {
    addSection("Mechanics", get(bio, ["Hit / Mechanics Report", "Mechanics Report"]));

    const pitchColumns = [
  ["Power/Pitch 1", "Power/Pitch 1 Report"],
  ["Run/Pitch 2", "Run/Pitch 2 Report"],
  ["Field/Pitch 3", "Field/Pitch 3 Report"],
  ["Arm/Pitch 4", "Arm/Pitch 4 Report"],
  ["Pitch 5", "Pitch 5 Report"],
  ["Pitch 6", "Pitch 6 Report"],
  ["Pitch 7", "Pitch 7 Report"]
];

pitchColumns.forEach(pair => {
  if (!Array.isArray(pair)) return;

  const [pitchCol, reportCol] = pair;

  const pitchName = get(bio, [pitchCol]);
  const pitchReport = get(bio, [reportCol]);

  if (isRealValue(pitchName) && isRealValue(pitchReport)) {
    addSection(pitchName, pitchReport);
  }
});
  } else {
    addSection("Hit", get(bio, ["Hit / Mechanics Report", "Hit Report"]));
    addSection("Power", get(bio, ["Power/Pitch 1 Report", "Power Report"]));
    addSection("Run", get(bio, ["Run/Pitch 2 Report", "Run Report"]));
    addSection("Field", get(bio, ["Field/Pitch 3 Report", "Field Report"]));
    addSection("Arm", get(bio, ["Arm/Pitch 4 Report", "Arm Report"]));
  }

  addSection("Summary", get(bio, ["Summary Report"]));

  if (!sections.length) return;

  const statsCard = document.getElementById("statsCard");
  if (!statsCard) return;

  statsCard.insertAdjacentHTML("beforebegin", `
    <section class="card full-report-card" data-access="premium">
      <h2>
        Full Scouting Report
        ${isRealValue(fullUpdated) ? `<span class="tools-updated">(Last Updated: ${fullUpdated})</span>` : ""}
      </h2>

      <div class="full-report-grid">
        ${sections.map(section => `
          <div class="full-report-section">
            <h3>${section.title}</h3>
            <p>${formatReportText(section.text)}</p>
          </div>
        `).join("")}
      </div>
    </section>
  `);
}

function formatReportText(text) {
  return String(text || "")
    .trim()
    .replace(/\n/g, "<br>");
}

/* =========================
   SCOUTING NOTES
========================= */

function renderScoutingNotes(bio) {
  const notesList = [];

  for (let i = 1; i <= 10; i++) {
    const dateKey = i === 1 ? "Notes Updated" : `Notes Updated ${i}`;
    const notesKey = i === 1 ? "Scouting Notes" : `Scouting Notes ${i}`;

    const date = get(bio, [dateKey]);
    const notes = get(bio, [notesKey]);

    if (isRealValue(notes)) {
      notesList.push({
        title: isRealValue(date) ? date : `Report ${i}`,
        date,
        notes
      });
    }
  }

  if (!notesList.length) return;

  const statsCard = document.getElementById("statsCard");
  if (!statsCard) return;

  const first = notesList[0];

  statsCard.insertAdjacentHTML("beforebegin", `
    <section class="card scouting-history-card" data-access="premium">
      <h2>Scouting Notes</h2>

      <div class="note-tabs">
        ${notesList.map((item, index) => `
          <button class="note-tab ${index === 0 ? "active" : ""}" data-note-index="${index}">
            ${item.title}
          </button>
        `).join("")}
      </div>

      <div class="note-panel">
        <h3>
          Report
          ${isRealValue(first.date)
            ? `<span class="tools-updated">(Last Updated: ${first.date})</span>`
            : ""}
        </h3>

        <ul class="scouting-notes" id="scoutingNotesList">
          ${formatNotesAsList(first.notes)}
        </ul>
      </div>
    </section>
  `);

  const tabs = document.querySelectorAll(".note-tab");
  const list = document.getElementById("scoutingNotesList");
  const panelTitle = document.querySelector(".note-panel h3");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const index = Number(tab.dataset.noteIndex);
      const item = notesList[index];

      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      panelTitle.innerHTML = `
        Report
        ${isRealValue(item.date)
          ? `<span class="tools-updated">(Last Updated: ${item.date})</span>`
          : ""}
      `;

      list.innerHTML = formatNotesAsList(item.notes);
    });
  });
}

function formatNotesAsList(notes) {
  return String(notes || "")
    .split(/\n|•|- /)
    .map(item => item.trim())
    .filter(item => isRealValue(item))
    .map(item => `<li>${item}</li>`)
    .join("");
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
    ? ["K%","BB%","K-BB %","SwStr %","Whiff%","BABIP","LOB%","LD%","GB%","FB%","IFFB%","HR/FB"]
    : ["wRC+","BABIP","wOBA","K%","BB%","SwStr %","Whiff%","Pull %","Cent %","Oppo %","LD%","GB%","FB%","IFFB%"];

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
    <h2>
      Stats
      <span class="tools-updated">(MiLB stats only)</span>
    </h2>
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
/* =========================
   TRANSACTIONS
========================= */
async function renderTransactions(bio) {
  const mlbamId = get(bio, ["MLBAM ID", "MLB ID", "MiLB ID"]);

  if (!isRealValue(mlbamId)) return;

  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/transactions?playerId=${mlbamId}`
    );

    const data = await res.json();
    const transactions = (data.transactions || []).sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    if (!transactions.length) return;

    const container = document.querySelector(".container");
    const statsCard = document.getElementById("statsCard");

    if (!container || !statsCard) return;

    statsCard.insertAdjacentHTML("afterend", `
      <section class="card" id="transactionsCard">
        <h2>Transactions</h2>

        <ul class="transactions-list">
          ${transactions.slice(0, 30).map(t => `
            <li>
              <strong>${formatTransactionDate(t.date)}</strong>
              ${t.description || ""}
            </li>
          `).join("")}
        </ul>
      </section>
    `);

  } catch (err) {
    console.error("Transactions:", err);
  }
}

function formatTransactionDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}
/* =========================
   PLAYER CARD EXPORT
========================= */

function setupPlayerCardExport() {

  const button =
    document.getElementById(
      "exportPlayerCardButton"
    );


  if (!button) {
    return;
  }


  button.onclick =
    exportPlayerCard;
}


async function exportPlayerCard() {

  if (!currentPlayerExportData) {
    return;
  }


  const {
    bio,
    tools,
    stats,
    isPitcher
  } =
    currentPlayerExportData;


  const card =
    buildPlayerExportCard(
      bio,
      tools,
      stats,
      isPitcher
    );


  document.body.appendChild(
    card
  );


  try {

    /*
      Wait for images and fonts
      before capturing.
    */

    await waitForExportImages(
      card
    );


    if (
      document.fonts &&
      document.fonts.ready
    ) {
      await document.fonts.ready;
    }


    const canvas =
        await html2canvas(
          card,
          {
            backgroundColor:
              "#ffffff",

            scale:
              2,

            width:
              1600,

            height:
              1000,

            useCORS:
              true,

            allowTaint:
              false,

            logging:
              false
          }
        );


    const playerName =
      get(
        bio,
        [
          "Player",
          "Name"
        ]
      );


    const safeName =
      String(playerName)
        .trim()
        .replace(
          /[^a-zA-Z0-9]+/g,
          "-"
        )
        .replace(
          /^-+|-+$/g,
          ""
        );


    const link =
      document.createElement(
        "a"
      );


    link.download =
      `${safeName}-Backfield-Brew-Player-Card.png`;


    link.href =
      canvas.toDataURL(
        "image/png"
      );


    link.click();


  } catch (err) {

    console.error(
      "Player card export:",
      err
    );

    alert(
      "Unable to export player card."
    );


  } finally {

    card.remove();
  }
}


/* =========================
   BUILD EXPORT CARD
========================= */

function buildPlayerExportCard(
  bio,
  tools,
  stats,
  isPitcher
) {

  const card =
    document.createElement("div");

  card.className =
    "player-export-card";


  /* =========================
     BASIC PLAYER INFO
  ========================= */

  const playerName =
    get(bio, [
      "Player",
      "Name"
    ]);

  const picture =
    get(bio, [
      "Picture",
      "Image",
      "Photo",
      "Picture URL",
      "Image URL"
    ]);

  const rank =
    get(bio, [
      "Rank",
      "Current Rank"
    ]);

  const previousRank =
    get(bio, [
      "Previous Rank",
      "Preseason Rank",
      "Last Rank"
    ]);

  const position =
    get(bio, [
      "Position",
      "Pos"
    ]);

  const level =
    get(bio, [
      "Level",
      "Current Level"
    ]);

  const age =
    get(bio, ["Age"]);

  const birthday =
    get(bio, [
      "Birthday",
      "DOB",
      "Date of Birth"
    ]);

  const height =
    get(bio, ["Height"]);

  const weight =
    get(bio, ["Weight"]);

  const batThrow =
    get(bio, [
      "Bat / Throw",
      "Bat/Throw",
      "B/T"
    ]);

  const birthplace =
    get(bio, [
      "Birthplace",
      "Birth Place"
    ]);

  const acquired =
    get(bio, [
      "Acquired"
    ]);

  const acquiredDate =
    get(bio, [
      "Acquired Date",
      "Signing Date",
      "Signed Date"
    ]);

  const signedFor =
    get(bio, [
      "Signed For",
      "Signing Bonus",
      "Bonus"
    ]);

  const draft =
    get(bio, [
      "Draft/IFA",
      "Draft / IFA"
    ]);

   const signedBy =
     get(bio, [
       "Signed By",
       "Signing Scout",
       "Scout"
     ]);

   const rule5 =
     get(bio, [
       "Rule 5 Eligible",
       "Rule 5 Eligibility"
     ]);

  const movement =
    getPlayerExportMovement(
      rank,
      previousRank
    );


  const currentStats =
    getCurrentPlayerStats(stats);


  card.innerHTML = `

    <!-- =====================
         TOP PORTION
    ====================== -->

    <div class="export-card-top">


      <!-- LEFT BRAND / PHOTO -->

      <div class="export-card-left">

        <div class="export-brand">

          <img
            class="export-brand-logo"
            src="BFB-Logo.png"
            alt="Backfield Brew"
          >

        </div>


        <div class="export-photo-frame">

          ${
            isRealValue(picture)
              ? `
                <img
                  class="export-player-photo"
                  src="${picture}"
                  alt="${playerName}"
                  crossorigin="anonymous"
                >
              `
              : `
                <div class="export-photo-empty">
                  No Photo
                </div>
              `
          }

        </div>

      </div>


      <!-- CENTER PLAYER INFO -->

      <div class="export-card-center">

        <div class="export-player-heading">

          ${
            isRealValue(rank)
              ? `
                <div class="export-rank-block">
                  #${rank}
                </div>
              `
              : ""
          }


          <div class="export-name-block">

            <h1>
              ${playerName}
            </h1>

            <div class="export-position">
              ${position}
              ${
                isRealValue(level)
                  ? ` | ${level}`
                  : ""
              }
            </div>

          </div>


          ${
            movement
              ? `
                <div class="export-rank-change">
                  ${movement}
                </div>
              `
              : ""
          }

        </div>


        <div class="export-bio-columns">

          <div class="export-bio-column">

            ${buildExportInfo(
              "Bats/Throws",
              batThrow
            )}

            ${buildExportInfo(
              "Age",
              age,
              birthday
            )}

            ${buildExportInfo(
              "Height / Weight",
              [
                height,
                weight
              ]
                .filter(isRealValue)
                .join(" / ")
            )}

            ${buildExportInfo(
              "Birthplace",
              birthplace
            )}

           ${buildExportInfo(
             "Rule 5 Eligible",
             rule5
           )}
          </div>


          <div class="export-bio-column">

            ${buildExportInfo(
              "Acquired",
              acquired
            )}

            ${buildExportInfo(
              "Acquired Date",
              acquiredDate
            )}

            ${buildExportInfo(
              "Signed For",
              signedFor
            )}

            ${buildExportInfo(
             "Signing Scout",
             signedBy
           )}

           ${buildExportInfo(
             "Draft / IFA",
             draft
           )}

          </div>

        </div>

      </div>


      <!-- RIGHT TOOLS -->

      <div class="export-card-tools">

        <div class="export-section-title">
          ${
            isPitcher
              ? "Pitch Grades"
              : "Tool Grades"
          }
        </div>

        ${buildLandscapeExportTools(
          tools,
          isPitcher
        )}

      </div>

    </div>


    <!-- =====================
         STATS BOTTOM
    ====================== -->

    <div class="export-card-bottom">

      ${
        currentStats
          ? buildLandscapeExportStats(
              currentStats,
              isPitcher
            )
          : `
              <div class="export-no-stats">
                No current-season statistics available.
              </div>
            `
      }

    </div>


    <!-- =====================
         FOOTER
    ====================== -->

    <div class="export-card-footer">

      <span></span>

      <strong>
        backfieldbrew.com
      </strong>

      <span></span>

    </div>

  `;


  return card;
}
function buildExportInfo(
  label,
  value,
  secondary = ""
) {

  if (!isRealValue(value)) {
    return "";
  }


  return `
    <div class="export-info-item">

      <div class="export-info-label">
        ${label}
      </div>

      <div class="export-info-value">
        ${value}

        ${
          isRealValue(secondary)
            ? `
              <span class="export-info-secondary">
                (${secondary})
              </span>
            `
            : ""
        }

      </div>

    </div>
  `;
}


/* =========================
   LANDSCAPE TOOL GRADES
========================= */

function buildLandscapeExportTools(
  tools,
  isPitcher
) {

  if (!tools) {

    return `
      <div class="export-no-tools">
        No grades available
      </div>
    `;
  }


  const items = [];


  if (isPitcher) {

    const pitches = [
      ["Primary Pitch", "Pitch #1"],
      ["Secondary #1", "Pitch #2"],
      ["Secondary #2", "Pitch #3"],
      ["Secondary #3", "Pitch #4"],
      ["Secondary #4", "Pitch #5"],
      ["Secondary #5", "Pitch #6"],
      ["Secondary #6", "Pitch #7"]
    ];


    pitches.forEach(
      ([nameKey, gradeKey]) => {

        const name =
          get(tools, [nameKey]);

        const grade =
          get(tools, [gradeKey]);


        if (
          isRealValue(name) &&
          isRealValue(grade)
        ) {

          items.push({
            label: name,
            grade
          });
        }
      }
    );


    [
      ["Command", "Command"],
      ["Control", "Control"]
    ]
      .forEach(
        ([label, key]) => {

          const grade =
            get(tools, [key]);


          if (isRealValue(grade)) {

            items.push({
              label,
              grade
            });
          }
        }
      );

  } else {

    const preferredTools = [
      ["Hit", "Hit"],
      ["Raw Power", "Raw Power"],
      ["Game Power", "Game Power"],
      ["Bat to Ball", "Bat to Ball"],
      ["Swing Decisions", "Swing Decisions"],
      ["Speed", "Speed"],
      ["Field", "Field"],
      ["Arm", "Arm"]
    ];


    preferredTools.forEach(
      ([label, key]) => {

        const grade =
          get(tools, [key]);


        if (isRealValue(grade)) {

          items.push({
            label,
            grade
          });
        }
      }
    );
  }


  return `
    <div class="export-tools-list">

      ${items
        .map(item => {

          const barWidth =
            getExportGradeWidth(
              item.grade
            );


          return `
            <div class="export-tool-row">

              <div class="export-tool-label">
                ${item.label}
              </div>

              <div class="export-tool-bar">

                <div
                  class="export-tool-bar-fill"
                  style="width:${barWidth}%"
                ></div>

              </div>

              <div class="export-tool-grade">
                ${item.grade}
              </div>

            </div>
          `;
        })
        .join("")}

    </div>
  `;
}


function getExportGradeWidth(
  grade
) {

  const firstNumber =
    parseFloat(
      String(grade)
        .match(/\d+/)?.[0] || 0
    );


  if (!firstNumber) {
    return 0;
  }


  return Math.max(
    15,
    Math.min(
      100,
      (firstNumber / 80) * 100
    )
  );
}
function buildLandscapeExportStats(
  currentStats,
  isPitcher
) {

  const year =
    currentStats.year;

  const row =
    currentStats.row;


  if (isPitcher) {

    const standard = [
      "IP",
      "G",
      "GS",
      "ERA",
      "FIP",
      "xFIP",
      "K/9",
      "BB/9",
      "K/BB",
      "HR/9",
      "WHIP"
    ];


    const advanced = [
      "K%",
      "BB%",
      "K-BB%",
      "SwStr%",
      "Whiff%",
      "BABIP",
      "LOB%",
      "LD%",
      "GB%",
      "FB%",
      "IFFB%",
      "HR/FB"
    ];


    return `
      ${buildExportStatTable(
        `${year} Stats`,
        standard,
        row
      )}

      ${buildExportStatTable(
        "Advanced Stats",
        advanced,
        row
      )}
    `;

  }


  const standard = [
    "PA",
    "AB",
    "R",
    "H",
    "2B",
    "3B",
    "HR",
    "RBI",
    "BB",
    "SO",
    "SB",
    "CS",
    "AVG",
    "OBP",
    "SLG",
    "OPS",
    "wRC+"
  ];


  const advanced = [
    "ISO",
    "BABIP",
    "BB%",
    "K%",
    "SwStr%",
    "Whiff%",
    "Pull%",
    "Cent%",
    "Oppo%",
    "LD%",
    "GB%",
    "FB%",
    "IFFB%"
  ];


  return `
    ${buildExportStatTable(
      `${year} Stats`,
      standard,
      row
    )}

    ${buildExportStatTable(
      "Advanced Stats",
      advanced,
      row
    )}
  `;
}


function buildExportStatTable(
  title,
  columns,
  row
) {

  const available =
    columns.filter(column =>
      isRealValue(
        row[column]
      )
    );


  if (!available.length) {
    return "";
  }


  return `
    <div class="export-stat-section">

      <div class="export-stat-title">
        ${title}
      </div>


      <div
        class="export-stat-grid"
        style="
          grid-template-columns:
          repeat(${available.length}, 1fr);
        "
      >

        ${available
          .map(column => `
            <div class="export-stat-label">
              ${column}
            </div>
          `)
          .join("")}


        ${available
          .map(column => `
            <div class="export-stat-value">
              ${row[column]}
            </div>
          `)
          .join("")}

      </div>

    </div>
  `;
}
/* =========================
   RANK MOVEMENT
========================= */

function getPlayerExportMovement(
  currentRank,
  previousRank
) {

  const current =
    Number(currentRank);


  const previous =
    Number(previousRank);


  if (
    !Number.isFinite(current)
  ) {
    return "";
  }


  if (
    previousRank === "" ||
    previousRank === null ||
    previousRank === undefined ||
    !Number.isFinite(previous)
  ) {

    return `
      <span class="player-export-movement new">
        NEW
      </span>
    `;
  }


  const change =
    previous - current;


  if (change > 0) {

    return `
      <span class="player-export-movement up">
        ▲ ${change}
      </span>
    `;
  }


  if (change < 0) {

    return `
      <span class="player-export-movement down">
        ▼ ${Math.abs(change)}
      </span>
    `;
  }


  return "";
}


/* =========================
   CURRENT SEASON STATS
========================= */

function getCurrentPlayerStats(
  stats
) {

  if (
    !Array.isArray(stats) ||
    !stats.length
  ) {
    return null;
  }


  return [...stats]
    .sort(
      (a, b) =>
        Number(b.year) -
        Number(a.year)
    )[0];
}


/* =========================
   EXPORT TOOLS
========================= */

function buildPlayerExportTools(
  tools,
  isPitcher
) {

  if (!tools) {

    return `
      <p class="player-export-empty">
        No tool grades available.
      </p>
    `;
  }


  let items = [];


  if (isPitcher) {

    const pitchMap = [

      [
        ["Primary Pitch"],
        ["Pitch #1", "Pitch#1"]
      ],

      [
        ["Secondary #1"],
        ["Pitch #2", "Pitch#2"]
      ],

      [
        ["Secondary #2"],
        ["Pitch #3", "Pitch#3"]
      ],

      [
        ["Secondary #3"],
        ["Pitch #4", "Pitch#4"]
      ],

      [
        ["Secondary #4"],
        ["Pitch #5", "Pitch#5"]
      ],

      [
        ["Secondary #5"],
        ["Pitch #6", "Pitch#6"]
      ],

      [
        ["Secondary #6"],
        ["Pitch #7", "Pitch#7"]
      ]

    ];


    pitchMap.forEach(
      ([nameCols, gradeCols]) => {

        const name =
          get(
            tools,
            nameCols
          );


        const grade =
          get(
            tools,
            gradeCols
          );


        if (
          isRealValue(name) &&
          isRealValue(grade)
        ) {

          items.push({
            label: name,
            value: grade
          });
        }
      }
    );


    [
      ["Command", "Command"],
      ["Control", "Control"],
      [
        "Fastball Velo",
        "Fastball Velocity"
      ]
    ]
      .forEach(
        ([label, key]) => {

          const value =
            get(
              tools,
              [key]
            );


          if (
            isRealValue(value)
          ) {

            items.push({
              label,
              value
            });
          }
        }
      );


  } else {

    const skip =
      new Set([
        "Player-ID",
        "Player ID",
        "Player",
        "Tools Updated",
        "Last Updated"
      ]);


    items =
      Object.entries(
        tools
      )
        .filter(
          ([key, value]) =>
            !skip.has(key) &&
            isRealValue(value)
        )
        .map(
          ([label, value]) => ({
            label,
            value
          })
        );
  }


  return `

    <div class="player-export-tool-grid">

      ${items
        .map(item => `

          <div class="player-export-tool">

            <span>
              ${item.label}
            </span>

            <strong>
              ${item.value}
            </strong>

          </div>

        `)
        .join("")}

    </div>
  `;
}


/* =========================
   EXPORT STATS
========================= */

function buildPlayerExportStats(
  row,
  isPitcher
) {

  const columns =
    isPitcher

      ? [
          "IP",
          "ERA",
          "FIP",
          "WHIP",
          "K/9",
          "BB/9"
        ]

      : [
          "PA",
          "HR",
          "OBP",
          "SLG",
          "OPS",
          "wRC+"
        ];


  return `

    <div class="player-export-stat-grid">

      ${columns
        .filter(
          key =>
            isRealValue(
              row[key]
            )
        )
        .map(key => `

          <div class="player-export-stat">

            <span>
              ${key}
            </span>

            <strong>
              ${row[key]}
            </strong>

          </div>

        `)
        .join("")}

    </div>
  `;
}


/* =========================
   IMAGE LOADING
========================= */

function waitForExportImages(
  element
) {

  const images =
    [
      ...element.querySelectorAll(
        "img"
      )
    ];


  return Promise.all(
    images.map(img => {

      if (img.complete) {
        return Promise.resolve();
      }


      return new Promise(resolve => {

        img.onload =
          resolve;

        img.onerror =
          resolve;

      });
    })
  );
}
/* =========================
   ARCHIVE PAGES
========================= */

async function initArchivePage() {
  const status = document.getElementById("status");

  try {
    const players = await loadSheet("Archived Biography Info");

    const clean = players.filter(p => {
      const id = get(p, ["Player-ID", "Player ID"]);
      const name = get(p, ["Player", "Name"]);
      p["Player-ID"] = id;
      p["Player"] = name;
      return id && name;
    });

    setupFilters(clean);
    attachArchiveFilterListeners(clean);
    renderArchiveRanking(clean);

    status.textContent = "";
  } catch (err) {
    status.textContent = err.message;
  }
}

function attachArchiveFilterListeners(players) {
  ["searchBox", "typeFilter", "positionFilter", "levelFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => renderArchiveRanking(players));
      el.addEventListener("change", () => renderArchiveRanking(players));
    }
  });
}

function renderArchiveRanking(players) {
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
        <td>
          <a class="ranking-player-link" href="archive-player.html?id=${encodeURIComponent(get(p, ["Player-ID"]))}">
            ${isRealValue(get(p, ["Picture", "Image", "Photo", "Picture URL", "Image URL"]))
              ? `<img class="ranking-player-photo" src="${get(p, ["Picture", "Image", "Photo", "Picture URL", "Image URL"])}" alt="${get(p, ["Player"])}" onerror="this.style.display='none';">`
              : ""}
            <span>${get(p, ["Player"])}</span>
          </a>
        </td>
        <td>${get(p, ["OFP"])}</td>
        <td>${get(p, ["Position", "Pos"])}</td>
        <td>${get(p, ["Height"])}</td>
        <td>${get(p, ["Weight"])}</td>
        <td>${get(p, ["Archive Reason", "Reason", "Status"])}</td>
      </tr>
    `).join("");
}

async function initArchivePlayerPage() {

  const id =
    new URLSearchParams(
      window.location.search
    ).get("id");


  if (!id) {

    document.body.innerHTML =
      "<h2>Archived player not found</h2>";

    return;
  }


  try {

    /* =========================
       MATCH GENERATED FILE NAME
    ========================= */

    const safeID =
      String(id)
        .trim()
        .replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );


    /* =========================
       LOAD ONE PLAYER FILE
    ========================= */

    const response =
      await fetch(
        `data/archived-players/${safeID}.json`
      );


    if (!response.ok) {

      throw new Error(
        "Archived player data not found"
      );
    }


    const playerData =
      await response.json();


    /* =========================
       PLAYER DATA
    ========================= */

    const bio =
      playerData.bio || {};


    const tools =
      playerData.tools || null;


    const videos =
      Array.isArray(
        playerData.videos
      )
        ? playerData.videos
        : [];


    const isPitcher =
      String(
        playerData.playerType ||
        get(
          bio,
          ["Player Type"]
        )
      )
        .toLowerCase()
        .includes("pitch");


    /* =========================
       CONVERT STATS OBJECT
       TO EXISTING PAGE FORMAT
    ========================= */

    const stats =
      Object.entries(
        playerData.stats || {}
      )
        .map(
          ([year, row]) => {

            if (
              !row ||
              typeof row !== "object"
            ) {
              return null;
            }


            /* =========================
               CHECK FOR ACTUAL STATS
            ========================= */

            const ignoreFields = new Set([
              "Player-ID",
              "Player ID",
              "Player",
              "PlayerName",
              "Player Name",
              "Name",
              "Archived?",
              "Team",
              "Level",
              "Age",
              "Season",
              "Year"
            ]);


            const hasRealStats =
              Object.entries(row)
                .some(([key, value]) => {

                  if (
                    ignoreFields.has(key)
                  ) {
                    return false;
                  }


                  const cleaned =
                    String(value ?? "")
                      .trim();


                  return (
                    cleaned !== "" &&
                    cleaned.toLowerCase() !== "n/a" &&
                    cleaned.toLowerCase() !== "na" &&
                    cleaned !== "-"
                  );
                });


            if (!hasRealStats) {
              return null;
            }


            return {
              year,
              row
            };
          }
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            Number(a.year) -
            Number(b.year)
        );


    /* =========================
       USE EXISTING ARCHIVE
       RENDERER
    ========================= */

    renderArchivePlayerPage(
      bio,
      tools,
      stats,
      isPitcher,
      videos
    );


  } catch (err) {

    console.error(
      "Archived player page:",
      err
    );


    document.body.innerHTML =
      `<h2>${err.message}</h2>`;

  }
}

function renderArchivePlayerPage(bio, tools, stats, isPitcher, videos) {
  renderPlayerPage(bio, tools, stats, isPitcher, videos, true);

  const archiveReason = get(bio, ["Archive Reason", "Reason", "Status"]);

  if (isRealValue(archiveReason)) {
    const hero = document.getElementById("playerHero");

    if (hero) {
      hero.insertAdjacentHTML("beforeend", `
        <div class="archive-reason">
          Archived: ${archiveReason}
        </div>
      `);
    }
  }
}
/* =========================
   SCOUTING LOGS
========================= */

async function initLogsPage() {
  try {
    const bioRows = await loadSheet("Biography Info");
    const archivedRows = await loadSheet("Archived Biography Info").catch(() => []);

    const hitterTools = await loadSheet("Hitter Tools").catch(() => []);
    const pitcherTools = await loadSheet("Pitcher Tools").catch(() => []);

    const logs = [];

    function addBioLogs(player, isArchived = false) {
      const playerName = get(player, ["Player", "Name"]);
      const playerID = get(player, ["Player-ID", "Player ID"]);

      if (!isRealValue(playerName) || !isRealValue(playerID)) return;

      const href = `${isArchived ? "archive-player.html" : "player.html"}?id=${encodeURIComponent(playerID)}`;

      const ofpDate = get(player, ["OFP Updated"]);

      if (isRealValue(ofpDate)) {
        logs.push({
          date: ofpDate,
          type: "OFP",
          player: playerName,
          playerID,
          href,
          update: "OFP tier updated"
        });
      }

      const fullReportDate = get(player, ["Full Report Updated"]);

      if (isRealValue(fullReportDate)) {
        logs.push({
          date: fullReportDate,

          type: "Full Scouting Reports",

          player: playerName,

          playerID: playerID,

          href: href,

          update: "Full scouting report updated"
        });
      }

      for (let i = 1; i <= 10; i++) {
        const dateCol = i === 1 ? "Notes Updated" : `Notes Updated ${i}`;
        const reportDate = get(player, [dateCol]);

        if (isRealValue(reportDate)) {
          logs.push({
            date: reportDate,
            type: "Scouting Notes",
            player: playerName,
            playerID,
            href,
            update: "Scouting notes updated"
          });
        }
      }
    }

    bioRows.forEach(player => addBioLogs(player, false));
    archivedRows.forEach(player => addBioLogs(player, true));

    [...hitterTools, ...pitcherTools].forEach(player => {
      const toolDate = get(player, ["Last Updated", "Tools Updated"]);
      const playerName = get(player, ["Player", "Name"]);
      const playerID = get(player, ["Player-ID", "Player ID"]);

      if (isRealValue(toolDate) && isRealValue(playerName) && isRealValue(playerID)) {
        logs.push({
          date: toolDate,
          type: "Tools",
          player: playerName,
          playerID,
          href: `player.html?id=${encodeURIComponent(playerID)}`,
          update: "Tool grades updated"
        });
      }
    });

    logs.sort((a, b) => parseLogDate(b.date) - parseLogDate(a.date));

    renderLogs(logs);

    ["logSearchBox", "logTypeFilter"].forEach(id => {
      const el = document.getElementById(id);

      if (el) {
        el.addEventListener("input", () => renderLogs(logs));
        el.addEventListener("change", () => renderLogs(logs));
      }
    });

  } catch (err) {
    console.error("Logs page:", err);
  }
}

function parseLogDate(value) {
  const raw = String(value || "").trim();

  if (!raw) return new Date(0);

  if (raw.includes("/")) {
    return new Date(raw);
  }

  const n = Number(raw);

  if (Number.isFinite(n)) {
    return new Date((n - 25569) * 86400 * 1000);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function renderLogs(logs) {
  const table = document.querySelector("#logsTable tbody");
  if (!table) return;

  const search = String(document.getElementById("logSearchBox")?.value || "")
    .toLowerCase()
    .trim();

  const type = document.getElementById("logTypeFilter")?.value || "";

  const filtered = logs.filter(log => {
    const player = String(log.player || "").toLowerCase();

    return (
      (!search || player.includes(search)) &&
      (!type || log.type === type)
    );
  });

  table.innerHTML = filtered.map(log => `
    <tr>
      <td>${formatLogDate(log.date)}</td>
      <td>${log.type}</td>
      <td>
        <a href="${log.href || `player.html?id=${encodeURIComponent(log.playerID)}`}">
          ${log.player}
        </a>
      </td>
      <td>${log.update}</td>
    </tr>
  `).join("");
}
/* =========================
   Depth Chart
========================= */

async function initDepthPage() {
  try {
    const [rows, bioRows] = await Promise.all([
      loadSheet("MiLB Depth Chart"),
      loadSheet("Biography Info").catch(() => [])
    ]);

    const rankMap = new Map();

    bioRows.forEach(player => {
      const playerID = get(player, ["Player-ID", "Player ID"]);
      const rank = get(player, ["Rank"]);

      if (isRealValue(playerID) && isRealValue(rank)) {
        rankMap.set(String(playerID).trim(), rank);
      }
    });

    renderDepthCards(rows, rankMap);

  } catch (err) {
    console.error("Depth page:", err);
  }
}


function renderDepthCards(rows, rankMap = new Map()) {
  const container = document.getElementById("depthCards");

  if (!container || !rows.length) return;


  /* =========================
     ORGANIZATION TOTALS
  ========================= */

  const orgRow = rows.find(row =>
    String(get(row, ["Level"]))
      .toLowerCase()
      .trim() === "organization"
  );

  const depthTitle =
    document.getElementById("depthTitle");

  if (orgRow && depthTitle) {
    depthTitle.innerHTML = `
      Organizational Depth Chart

      <span class="tools-updated">
        (40-Man Total: ${get(orgRow, ["On 40-Man"])} |
        Stateside Total: ${get(orgRow, ["Stateside Total"])}/${get(orgRow, ["Stateside Limit"])} |
        Total MiLB Players in Organization: ${get(orgRow, ["Total Players in Organization"])})
      </span>
    `;
  }


  /* =========================
     LEVEL ORDER
  ========================= */

  const levelOrder = [
    "MLB",
    "AAA",
    "AA",
    "A+",
    "A",
    "ROK",
    "DSL"
  ];


  /* =========================
     GROUP ROWS
  ========================= */

  const grouped = {};

  rows.forEach(row => {
    const level = get(row, ["Level"]);
    const team = get(row, ["Team"]);
    const section = get(row, ["Section"]);

    if (
      !isRealValue(level) ||
      !isRealValue(team) ||
      !isRealValue(section)
    ) {
      return;
    }

    if (!grouped[level]) {
      grouped[level] = {};
    }

    if (!grouped[level][team]) {
      grouped[level][team] = {};
    }

    if (!grouped[level][team][section]) {
      grouped[level][team][section] = [];
    }

    grouped[level][team][section].push(row);
  });


  /* =========================
     RENDER TEAM CARDS
  ========================= */

  container.innerHTML = levelOrder
    .filter(level => grouped[level])

    .map(level => {

      return Object.entries(grouped[level])

        .map(([team, sections]) => {

          const firstSection =
            Object.keys(sections)[0];

          const firstRow =
            sections[firstSection]?.[0];

          const teamLogo =
            firstRow
              ? get(firstRow, ["Team Logo"])
              : "";

          return `
            <section class="depth-card">

              <div class="depth-card-header">

                <div class="depth-team-info">
                  <h3>${team}</h3>
                  <span>${level}</span>
                </div>

                ${
                  isRealValue(teamLogo)
                    ? `
                      <img
                        class="depth-logo"
                        src="${teamLogo}"
                        alt="${team}"
                        onerror="this.style.display='none';"
                      >
                    `
                    : ""
                }

              </div>


              <div class="depth-grid">

                ${renderDepthSection(
                  "Rotation",
                  sections,
                  rankMap
                )}

                ${renderDepthSection(
                  "Lineup",
                  sections,
                  rankMap
                )}

                ${renderDepthSection(
                  "Bullpen",
                  sections,
                  rankMap
                )}

                ${renderDepthSection(
                  "Bench",
                  sections,
                  rankMap
                )}

                ${renderDepthSection(
                  "60 or Full-Season IL",
                  sections,
                  rankMap
                )}

                ${renderDepthSection(
                  "7 Day IL or Development List",
                  sections,
                  rankMap
                )}

                ${renderDepthSection(
                  "60 Day IL",
                  sections,
                  rankMap
                )}

                ${renderDepthSection(
                  "10/15 Day IL",
                  sections,
                  rankMap
                )}

              </div>

            </section>
          `;
        })

        .join("");
    })

    .join("");
}


/* =========================
   DEPTH SECTION
========================= */

function renderDepthSection(
  sectionName,
  sections,
  rankMap = new Map()
) {

  const players =
    sections[sectionName] || [];

  if (!players.length) return "";


  return `
    <div class="depth-section">

      <h4>${sectionName}</h4>

      ${players.map(row => {

        const pos =
          get(row, [
            "Pos",
            "Position",
            "Hand"
          ]);

        const player =
          get(row, [
            "Player",
            "Name"
          ]);

        const playerID =
          get(row, [
            "Player-ID",
            "Player ID"
          ]);

        const bref =
          cleanUrl(
            get(row, [
              "Baseball Reference",
              "BBRef",
              "Baseball Reference Link"
            ])
          );


        /* =========================
           PLAYER LINK
        ========================= */

        let href = "";

        const isArchived =
          String(
            get(row, [
              "Archived",
              "Archive"
            ])
          )
            .toLowerCase()
            .trim() === "yes";


        if (isRealValue(playerID)) {

          href =
            `${
              isArchived
                ? "archive-player.html"
                : "player.html"
            }?id=${encodeURIComponent(playerID)}`;

        } else if (isRealValue(bref)) {

          href = bref;
        }


        /* =========================
           40-MAN
        ========================= */

        const fortyMan =
          String(
            get(row, ["40-Man"])
          )
            .toLowerCase()
            .trim() === "yes";


        /* =========================
           PROSPECT RANK
        ========================= */

        const rank =
          isRealValue(playerID)
            ? rankMap.get(
                String(playerID).trim()
              )
            : "";

        const rankNumber =
          Number(rank);

        let rankHTML = "";

        if (
          isRealValue(rank) &&
          Number.isFinite(rankNumber)
        ) {

          const rankClass =
            rankNumber <= 50
              ? "depth-rank-top50"
              : "depth-rank-others";

          rankHTML = `
            <span
              class="depth-rank ${rankClass}"
              title="Backfield Brew Prospect Rank"
            >
              #${rank}
            </span>
          `;
        }


        /* =========================
           PLAYER ROW
        ========================= */

        return `
          <div class="depth-player-row">

            <span class="depth-pos">
              ${pos}
            </span>


            <div class="depth-player-link-wrap">

              ${
                href
                  ? `
                    <a
                      href="${href}"
                      ${
                        href.startsWith("http")
                          ? `target="_blank" rel="noopener"`
                          : ""
                      }
                    >
                      ${player}
                    </a>
                  `
                  : `
                    <span>
                      ${player}
                    </span>
                  `
              }


              ${rankHTML}


              ${
                fortyMan
                  ? `
                    <span class="forty-man-badge">
                      40
                    </span>
                  `
                  : ""
              }

            </div>

          </div>
        `;

      }).join("")}

    </div>
  `;
}
/* =========================
   Draft History
========================= */

async function initDraftPage() {
  try {

    const rows =
      await loadSheet("Draft History");


    const years =
      [...new Set(
        rows
          .map(row =>
            get(row, ["Draft Year"])
          )
          .filter(isRealValue)
      )]
        .sort(
          (a, b) =>
            Number(b) - Number(a)
        );


    renderDraftTabs(
      rows,
      years
    );


    renderDraftYear(
      rows,
      years[0]
    );


  } catch (err) {

    console.error(
      "Draft page:",
      err
    );
  }
}


/* =========================
   YEAR TABS
========================= */

function renderDraftTabs(
  rows,
  years
) {

  const tabs =
    document.getElementById(
      "draftYearTabs"
    );


  if (!tabs) return;


  tabs.innerHTML =
    years
      .map((year, index) => `

        <button
          class="draft-tab ${
            index === 0
              ? "active"
              : ""
          }"
          data-year="${year}"
        >
          ${year}
        </button>

      `)
      .join("");


  tabs
    .querySelectorAll(
      ".draft-tab"
    )
    .forEach(tab => {

      tab.addEventListener(
        "click",
        () => {

          tabs
            .querySelectorAll(
              ".draft-tab"
            )
            .forEach(t =>
              t.classList.remove(
                "active"
              )
            );


          tab.classList.add(
            "active"
          );


          renderDraftYear(
            rows,
            tab.dataset.year
          );
        }
      );
    });
}


/* =========================
   RENDER SELECTED YEAR
========================= */

function renderDraftYear(
  rows,
  year
) {

  const yearRows =
    rows.filter(row =>
      get(row, ["Draft Year"]) === year
    );


  const poolRow =
    yearRows.find(row =>
      String(
        get(row, ["Player"])
      )
        .toLowerCase()
        .trim() === "draft pool"
    );


  const playerRows =
    yearRows.filter(row =>
      String(
        get(row, ["Player"])
      )
        .toLowerCase()
        .trim() !== "draft pool"
    );


  renderDraftSummary(
    poolRow
  );


  renderDraftTable(
    playerRows
  );


  renderDraftClassSummary(
    playerRows,
    year
  );


  renderDraftInfo(
    poolRow,
    year
  );
}


/* =========================
   BONUS POOL SUMMARY
========================= */

function renderDraftSummary(
  poolRow
) {

  const box =
    document.getElementById(
      "draftSummary"
    );


  if (!box) return;


  if (!poolRow) {

    box.innerHTML = "";

    return;
  }


  box.innerHTML = `

    <div class="draft-summary">

      <span>
        Bonus Pool Cap:
        <strong>
          ${get(
            poolRow,
            ["Bonus Pool Cap"]
          )}
        </strong>
      </span>


      <span>
        Cap + 5%:
        <strong>
          ${get(
            poolRow,
            ["Cap + 5%"]
          )}
        </strong>
      </span>


      <span>
        Cap $ Spent:
        <strong>
          ${get(
            poolRow,
            ["Cap $ Spent"]
          )}
        </strong>
      </span>


      <span>
        Cap $ Remaining:
        <strong>
          ${get(
            poolRow,
            ["Cap $ Remaining"]
          )}
        </strong>
      </span>

    </div>
  `;
}


/* =========================
   DRAFT TABLE
========================= */

function renderDraftTable(
  rows
) {

  const table =
    document.getElementById(
      "draftTable"
    );


  if (!table) return;


  const headers = [
    "Tags",
    "Rd",
    "OVR Pick",
    "Position",
    "Player",
    "School",
    "Slot Value",
    "Signing Bonus",
    "Pool Hit",
    "Signing Scout"
  ];


  table
    .querySelector("thead")
    .innerHTML = `

      <tr>
        ${headers
          .map(h =>
            `<th>${h}</th>`
          )
          .join("")}
      </tr>
    `;


  table
    .querySelector("tbody")
    .innerHTML =

      rows
        .map(row => {

          const player =
            get(row, ["Player"]);


          const playerID =
            get(row, [
              "Player ID",
              "Player-ID"
            ]);


          const archived =
            String(
              get(row, [
                "Archived?",
                "Archived",
                "Archive"
              ])
            )
              .toLowerCase()
              .trim() === "yes";


          const bref =
            cleanUrl(
              get(row, [
                "Baseball Reference",
                "BBRef",
                "Baseball Reference Link"
              ])
            );


          let isBrefLink = false;

          let href = "";


          if (
            isRealValue(playerID)
          ) {

            href =
              `${
                archived
                  ? "archive-player.html"
                  : "player.html"
              }?id=${encodeURIComponent(
                playerID
              )}`;


          } else if (
            isRealValue(bref)
          ) {

            href = bref;

            isBrefLink = true;
          }


          return `

            <tr>

              <td class="draft-tag-cell">
                ${renderDraftTags(row)}
              </td>


              <td>
                ${get(
                  row,
                  ["Rd", "Round"]
                )}
              </td>


              <td>
                ${get(
                  row,
                  ["OVR Pick"]
                )}
              </td>


              <td>
                ${get(
                  row,
                  [
                    "Position",
                    "Pos"
                  ]
                )}
              </td>


              <td>

                ${
                  href

                    ? `
                      <a
                        href="${href}"
                        ${
                          isBrefLink
                            ? `target="_blank" rel="noopener"`
                            : ""
                        }
                      >
                        ${player}

                        ${
                          isBrefLink
                            ? `
                              <span class="bref-badge">
                                BRef
                              </span>
                            `
                            : ""
                        }

                      </a>
                    `

                    : player
                }

              </td>


              <td>
                ${get(
                  row,
                  ["School"]
                )}
              </td>


              <td>
                ${get(
                  row,
                  ["Slot Value"]
                )}
              </td>


              <td>
                ${get(
                  row,
                  [
                    "Signing Bonus",
                    "Signing Bonus "
                  ]
                )}
              </td>


              <td>
                ${get(
                  row,
                  ["Pool Hit"]
                )}
              </td>


              <td>
                ${get(
                  row,
                  ["Signing Scout"]
                )}
              </td>

            </tr>
          `;

        })
        .join("");
}


/* =========================
   DRAFT CLASS SUMMARY
========================= */

function renderDraftClassSummary(
  rows,
  year
) {

  const box =
    document.getElementById(
      "draftClassSummary"
    );


  if (!box) return;


  let selected = 0;

  let ndfa = 0;

  let stillInOrg = 0;

  let mlbBrewers = 0;

  let mlbOther = 0;

  let traded = 0;

  let released = 0;

  let waived = 0;

  let mlbFreeAgent = 0;

  let minorLeagueFreeAgent = 0;

  let unsigned = 0;


  rows.forEach(row => {

    const player =
      get(row, ["Player"]);


    if (
      !isRealValue(player)
    ) {
      return;
    }


    /* =========================
       DRAFT PICK VS NDFA

       NDFA is determined ONLY
       by the Rd column.
    ========================= */

    const round =
      String(
        get(row, [
          "Rd",
          "Round"
        ]) || ""
      )
        .trim()
        .toUpperCase();


    if (round === "NDFA") {

      ndfa++;

    } else {

      selected++;
    }


    /* =========================
       STATUS TAGS
    ========================= */

    const tags = [
      get(row, ["Tag 1"]),
      get(row, ["Tag 2"])
    ]
      .map(tag =>
        String(tag || "")
          .trim()
          .toUpperCase()
      )
      .filter(Boolean);


    if (
      tags.includes("CREW")
    ) {
      stillInOrg++;
    }


    if (
      tags.includes("MLB")
    ) {
      mlbBrewers++;
    }


    if (
      tags.includes("MLB-O")
    ) {
      mlbOther++;
    }


    if (
      tags.includes("TRADED")
    ) {
      traded++;
    }


    if (
      tags.includes("RELEASED")
    ) {
      released++;
    }


    if (
      tags.includes("WAIVED")
    ) {
      waived++;
    }


    if (
      tags.includes("FA")
    ) {
      mlbFreeAgent++;
    }


    if (
      tags.includes("MLFA")
    ) {
      minorLeagueFreeAgent++;
    }


    if (
      tags.includes("DNS")
    ) {
      unsigned++;
    }

  });


  const summaryItems = [

    {
      label:
        "Players Selected",
      value:
        selected,
      show:
        true
    },

    {
      label:
        "NDFA Signings",
      value:
        ndfa,
      show:
        ndfa > 0
    },

    {
      label:
        "Still in Organization",
      value:
        stillInOrg,
      show:
        true
    },

    {
      label:
        "Reached MLB with Brewers",
      value:
        mlbBrewers,
      show:
        mlbBrewers > 0
    },

    {
      label:
        "Reached MLB Elsewhere",
      value:
        mlbOther,
      show:
        mlbOther > 0
    },

    {
      label:
        "Traded",
      value:
        traded,
      show:
        traded > 0
    },

    {
      label:
        "Released",
      value:
        released,
      show:
        released > 0
    },

    {
      label:
        "Waived / DFA",
      value:
        waived,
      show:
        waived > 0
    },

    {
      label:
        "MLB Free Agent",
      value:
        mlbFreeAgent,
      show:
        mlbFreeAgent > 0
    },

    {
      label:
        "Minor League Free Agent",
      value:
        minorLeagueFreeAgent,
      show:
        minorLeagueFreeAgent > 0
    },

    {
      label:
        "Did Not Sign",
      value:
        unsigned,
      show:
        unsigned > 0
    }

  ];


  box.innerHTML = `

    <div class="draft-class-summary">

      <h3>
        ${year} Draft Class Summary
      </h3>


      <div class="draft-class-summary-grid">

        ${summaryItems
          .filter(item =>
            item.show
          )
          .map(item => `

            <div class="draft-class-summary-item">

              <span class="draft-class-summary-value">
                ${item.value}
              </span>

              <span class="draft-class-summary-label">
                ${item.label}
              </span>

            </div>

          `)
          .join("")}

      </div>

    </div>
  `;
}


/* =========================
   DRAFT TAGS
========================= */

function renderDraftTags(row) {

  const tags = [

    {
      tag:
        get(row, ["Tag 1"]),

      note:
        get(row, ["Tag 1 Note"])
    },

    {
      tag:
        get(row, ["Tag 2"]),

      note:
        get(row, ["Tag 2 Note"])
    }

  ]
    .filter(item =>
      isRealValue(item.tag)
    );


  if (!tags.length) {
    return "";
  }


  return `

    <div
      class="draft-tags ${
        tags.length === 1
          ? "single"
          : ""
      }"
    >

      ${tags
        .map(item => `

          <span
            class="${getDraftTagClass(
              item.tag
            )} draft-tag-tooltip"
          >

            ${formatDraftTagText(
              item.tag
            )}


            ${
              isRealValue(
                item.note
              )

                ? `
                  <span class="draft-tooltip-text">
                    ${item.note}
                  </span>
                `

                : ""
            }

          </span>

        `)
        .join("")}

    </div>
  `;
}


/* =========================
   FORMAT TAG TEXT
========================= */

function formatDraftTagText(
  tag
) {

  const clean =
    String(tag || "")
      .trim();


  if (
    clean === "MLB-O"
  ) {
    return "MLB";
  }


  return clean;
}


/* =========================
   TAG COLORS
========================= */

function getDraftTagClass(
  tag
) {

  const clean =
    String(tag || "")
      .trim()
      .toLowerCase();


  if (
    clean === "crew"
  ) {
    return "draft-tag draft-tag-navy";
  }


  if (
    clean === "dns"
  ) {
    return "draft-tag draft-tag-red";
  }


  if (
    clean === "mlb"
  ) {
    return "draft-tag draft-tag-navy";
  }


  if (
    clean === "mlb-o"
  ) {
    return "draft-tag draft-tag-yellow";
  }


  return "draft-tag draft-tag-light";
}


/* =========================
   DRAFT NOTES / LEGEND
========================= */

function renderDraftInfo(
  poolRow,
  year
) {

  const box =
    document.getElementById(
      "draftInfo"
    );


  if (!box) return;


  box.innerHTML = `

    <div class="draft-info-grid">

      <div>

        <h3>
          ${year} Draft Notes
        </h3>


        <p>
          <strong>Dates:</strong>
          ${get(
            poolRow,
            ["Dates"]
          ) || "N/A"}
        </p>


        <p>
          <strong>GM/POBO:</strong>
          ${get(
            poolRow,
            ["GM/POBO"]
          ) || "N/A"}
        </p>


        <p>
          <strong>
            Scouting Director:
          </strong>

          ${get(
            poolRow,
            ["Scouting Director"]
          ) || "N/A"}
        </p>


        <p>
          <strong>
            Signing Deadline:
          </strong>

          ${get(
            poolRow,
            ["Signing Deadline"]
          ) || "N/A"}
        </p>


        <p class="draft-note-text">
          Unsigned picks must sign by the listed deadline unless otherwise eligible to return to school.
        </p>

      </div>


      <div>

        <h3>
          Draft Legend
        </h3>


        <div class="draft-legend">

          ${draftLegendRow(
            "CREW",
            "draft-tag-navy",
            "Player currently in Brewers organization"
          )}


          ${draftLegendRow(
            "DNS",
            "draft-tag-red",
            "Player did not sign with Brewers"
          )}


          ${draftLegendRow(
            "MLB",
            "draft-tag-navy",
            "Player has MLB experience with Brewers"
          )}


          ${draftLegendRow(
            "MLB",
            "draft-tag-yellow",
            "Player has MLB experience, not with Brewers"
          )}


          ${draftLegendRow(
            "Released",
            "draft-tag-light",
            "Player was released by Brewers"
          )}


          ${draftLegendRow(
            "Traded",
            "draft-tag-light",
            "Player was traded by Brewers"
          )}


          ${draftLegendRow(
            "Waived",
            "draft-tag-light",
            "Player was waived/DFA'd by Brewers"
          )}


          ${draftLegendRow(
            "FA",
            "draft-tag-light",
            "Player left Brewers as MLB free agent"
          )}


          ${draftLegendRow(
            "MLFA",
            "draft-tag-light",
            "Player left Brewers as minor league free agent"
          )}

        </div>


        <div class="draft-legend-notes">

          <p>
            <strong>Slot Value:</strong>
            MLB's slot allotment for the given draft slot
          </p>


          <p>
            <strong>Signing Bonus:</strong>
            Amount player signed for
          </p>


          <p>
            <strong>Pool Hit:</strong>
            Amount of Bonus $ counted towards Bonus Pool Cap
          </p>

        </div>

      </div>

    </div>
  `;
}


/* =========================
   LEGEND ROW
========================= */

function draftLegendRow(
  label,
  tagClass,
  text
) {

  return `

    <div class="draft-legend-row">

      <span
        class="draft-tag ${tagClass}"
      >
        ${label}
      </span>

      <span>
        ${text}
      </span>

    </div>
  `;
}
/* =========================
   International History
========================= */

async function initInternationalPage() {
  try {

    const rows =
      await loadSheet(
        "International Signing History"
      );


    const years =
      [...new Set(
        rows
          .map(row =>
            get(row, ["Signing Year"])
          )
          .filter(isRealValue)
      )]
        .sort(
          (a, b) =>
            Number(b) - Number(a)
        );


    renderInternationalTabs(
      rows,
      years
    );


    renderInternationalYear(
      rows,
      years[0]
    );


  } catch (err) {

    console.error(
      "International page:",
      err
    );
  }
}


/* =========================
   YEAR TABS
========================= */

function renderInternationalTabs(
  rows,
  years
) {

  const tabs =
    document.getElementById(
      "intlYearTabs"
    );


  if (!tabs) return;


  tabs.innerHTML =
    years
      .map((year, index) => `

        <button
          class="draft-tab ${
            index === 0
              ? "active"
              : ""
          }"
          data-year="${year}"
        >
          ${year}
        </button>

      `)
      .join("");


  tabs
    .querySelectorAll(
      ".draft-tab"
    )
    .forEach(tab => {

      tab.addEventListener(
        "click",
        () => {

          tabs
            .querySelectorAll(
              ".draft-tab"
            )
            .forEach(t =>
              t.classList.remove(
                "active"
              )
            );


          tab.classList.add(
            "active"
          );


          renderInternationalYear(
            rows,
            tab.dataset.year
          );
        }
      );
    });
}


/* =========================
   RENDER SELECTED YEAR
========================= */

function renderInternationalYear(
  rows,
  year
) {

  const yearRows =
    rows.filter(row =>
      get(row, ["Signing Year"]) === year
    );


  const bonusPoolRow =
    yearRows.find(row =>
      String(
        get(row, ["Player"])
      )
        .toLowerCase()
        .trim() === "bonus pool"
    );


  const playerRows =
    yearRows.filter(row =>
      String(
        get(row, ["Player"])
      )
        .toLowerCase()
        .trim() !== "bonus pool"
    );


  renderInternationalSummary(
    bonusPoolRow
  );


  renderInternationalTable(
    playerRows
  );


  renderInternationalClassSummary(
    playerRows,
    year
  );


  renderInternationalInfo(
    bonusPoolRow,
    year
  );
}


/* =========================
   BONUS POOL SUMMARY
========================= */

function renderInternationalSummary(
  poolRow
) {

  const box =
    document.getElementById(
      "intlSummary"
    );


  if (!box) return;


  if (!poolRow) {

    box.innerHTML = "";

    return;
  }


  box.innerHTML = `

    <div class="draft-summary">

      <span>
        Bonus Pool Cap:
        <strong>
          ${get(
            poolRow,
            ["Bonus Pool Cap"]
          )}
        </strong>
      </span>


      <span>
        Cap $ Spent:
        <strong>
          ${get(
            poolRow,
            ["Cap $ Spent"]
          )}
        </strong>
      </span>


      <span>
        Cap $ Remaining:
        <strong>
          ${get(
            poolRow,
            ["Cap $ Remaining"]
          )}
        </strong>
      </span>

    </div>
  `;
}


/* =========================
   INTERNATIONAL TABLE
========================= */

function renderInternationalTable(
  rows
) {

  const table =
    document.getElementById(
      "intlTable"
    );


  if (!table) return;


  const headers = [
    "Tags",
    "Position",
    "Player",
    "Country",
    "Signing Bonus",
    "Pool Hit",
    "Date Signed",
    "Signing Scout(s)"
  ];


  table
    .querySelector("thead")
    .innerHTML = `

      <tr>
        ${headers
          .map(h =>
            `<th>${h}</th>`
          )
          .join("")}
      </tr>
    `;


  table
    .querySelector("tbody")
    .innerHTML =

      rows
        .map(row => {

          const player =
            get(row, ["Player"]);


          const playerID =
            get(row, [
              "Player ID",
              "Player-ID"
            ]);


          const archived =
            String(
              get(row, [
                "Archived?",
                "Archived",
                "Archive"
              ])
            )
              .toLowerCase()
              .trim() === "yes";


          const bref =
            cleanUrl(
              get(row, [
                "Baseball Reference",
                "BBRef",
                "Baseball Reference Link"
              ])
            );


          let href = "";

          let isBrefLink = false;


          if (
            isRealValue(playerID)
          ) {

            href =
              `${
                archived
                  ? "archive-player.html"
                  : "player.html"
              }?id=${encodeURIComponent(
                playerID
              )}`;


          } else if (
            isRealValue(bref)
          ) {

            href = bref;

            isBrefLink = true;
          }


          return `

            <tr>

              <td class="draft-tag-cell">
                ${renderDraftTags(row)}
              </td>


              <td>
                ${get(
                  row,
                  [
                    "Position",
                    "Pos"
                  ]
                )}
              </td>


              <td>

                ${
                  href

                    ? `
                      <a
                        href="${href}"
                        ${
                          isBrefLink
                            ? `target="_blank" rel="noopener"`
                            : ""
                        }
                      >
                        ${player}

                        ${
                          isBrefLink
                            ? `
                              <span class="bref-badge">
                                BRef
                              </span>
                            `
                            : ""
                        }

                      </a>
                    `

                    : player
                }

              </td>


              <td>
                ${get(
                  row,
                  ["Country"]
                )}
              </td>


              <td>
                ${get(
                  row,
                  ["Signing Bonus"]
                )}
              </td>


              <td>
                ${get(
                  row,
                  ["Pool Hit"]
                )}
              </td>


              <td>
                ${get(
                  row,
                  ["Date Signed"]
                )}
              </td>


              <td>
                ${get(
                  row,
                  ["Signing Scout"]
                )}
              </td>

            </tr>
          `;

        })
        .join("");
}


/* =========================
   INTERNATIONAL CLASS SUMMARY
========================= */

function renderInternationalClassSummary(
  rows,
  year
) {

  const box =
    document.getElementById(
      "internationalClassSummary"
    );


  if (!box) return;


  let signed = 0;

  let stillInOrg = 0;

  let mlbBrewers = 0;

  let mlbOther = 0;

  let traded = 0;

  let released = 0;

  let waived = 0;

  let mlbFreeAgent = 0;

  let minorLeagueFreeAgent = 0;

  let unsigned = 0;


  const countryCounts =
    new Map();


  rows.forEach(row => {

    const player =
      get(row, ["Player"]);


    if (
      !isRealValue(player)
    ) {
      return;
    }


    const tags = [
      get(row, ["Tag 1"]),
      get(row, ["Tag 2"])
    ]
      .map(tag =>
        String(tag || "")
          .trim()
          .toUpperCase()
      )
      .filter(Boolean);


    const didNotSign =
      tags.includes("DNS");


    /* =========================
       SIGNING COUNT
    ========================= */

    if (didNotSign) {

      unsigned++;

    } else {

      signed++;


      /* =========================
         COUNTRY COUNT
      ========================= */

      const country =
        String(
          get(row, ["Country"]) || ""
        )
          .trim();


      if (
        isRealValue(country)
      ) {

        countryCounts.set(
          country,
          (
            countryCounts.get(country) ||
            0
          ) + 1
        );
      }
    }


    /* =========================
       STATUS COUNTS
    ========================= */

    if (
      tags.includes("CREW")
    ) {
      stillInOrg++;
    }


    if (
      tags.includes("MLB")
    ) {
      mlbBrewers++;
    }


    if (
      tags.includes("MLB-O")
    ) {
      mlbOther++;
    }


    if (
      tags.includes("TRADED")
    ) {
      traded++;
    }


    if (
      tags.includes("RELEASED")
    ) {
      released++;
    }


    if (
      tags.includes("WAIVED")
    ) {
      waived++;
    }


    if (
      tags.includes("FA")
    ) {
      mlbFreeAgent++;
    }


    if (
      tags.includes("MLFA")
    ) {
      minorLeagueFreeAgent++;
    }

  });


  const summaryItems = [

    {
      label:
        "Players Signed",
      value:
        signed,
      show:
        true
    },

    {
      label:
        "Still in Organization",
      value:
        stillInOrg,
      show:
        true
    },

    {
      label:
        "Reached MLB with Brewers",
      value:
        mlbBrewers,
      show:
        mlbBrewers > 0
    },

    {
      label:
        "Reached MLB Elsewhere",
      value:
        mlbOther,
      show:
        mlbOther > 0
    },

    {
      label:
        "Traded",
      value:
        traded,
      show:
        traded > 0
    },

    {
      label:
        "Released",
      value:
        released,
      show:
        released > 0
    },

    {
      label:
        "Waived / DFA",
      value:
        waived,
      show:
        waived > 0
    },

    {
      label:
        "MLB Free Agent",
      value:
        mlbFreeAgent,
      show:
        mlbFreeAgent > 0
    },

    {
      label:
        "Minor League Free Agent",
      value:
        minorLeagueFreeAgent,
      show:
        minorLeagueFreeAgent > 0
    },

    {
      label:
        "Did Not Sign",
      value:
        unsigned,
      show:
        unsigned > 0
    }

  ];


  const countries =
    [...countryCounts.entries()]
      .sort(
        (a, b) => {

          if (
            b[1] !== a[1]
          ) {
            return b[1] - a[1];
          }


          return a[0]
            .localeCompare(b[0]);
        }
      );


  box.innerHTML = `

    <div class="draft-class-summary">

      <h3>
        ${year} International Class Summary
      </h3>


      <div class="draft-class-summary-grid">

        ${summaryItems
          .filter(item =>
            item.show
          )
          .map(item => `

            <div class="draft-class-summary-item">

              <span class="draft-class-summary-value">
                ${item.value}
              </span>

              <span class="draft-class-summary-label">
                ${item.label}
              </span>

            </div>

          `)
          .join("")}

      </div>


      ${
        countries.length

          ? `

            <div class="international-country-summary">

              <h4>
                Players Signed By Country
              </h4>


              <div class="international-country-grid">

                ${countries
                  .map(
                    ([country, count]) => {

                      const flagCode =
                        getCountryFlagCode(
                          country
                        );


                      return `

                        <div class="international-country-item">

                          ${
                            flagCode
                              ? `
                                <img
                                  class="international-country-flag"
                                  src="https://flagcdn.com/w40/${flagCode}.png"
                                  srcset="
                                    https://flagcdn.com/w80/${flagCode}.png 2x
                                  "
                                  alt="${escapeInternationalHTML(country)} flag"
                                  title="${escapeInternationalHTML(country)}"
                                  loading="lazy"
                                >
                              `
                              : `
                                <span
                                  class="international-country-flag-fallback"
                                  title="${escapeInternationalHTML(country)}"
                                >
                                  🌐
                                </span>
                              `
                          }


                          <span class="international-country-name">
                            ${escapeInternationalHTML(
                              country
                            )}
                          </span>


                          <span class="international-country-count">
                            ${count}
                          </span>

                        </div>

                      `;
                    }
                  )
                  .join("")}

              </div>

            </div>

          `

          : ""
      }

    </div>
  `;
}


/* =========================
   COUNTRY FLAG CODES
========================= */

function getCountryFlagCode(
  country
) {

  const clean =
    String(country || "")
      .trim()
      .toLowerCase();


  const countryCodes = {

    "dominican republic": "do",
    "dominican": "do",
    "d.r.": "do",
    "dr": "do",

    "venezuela": "ve",

    "colombia": "co",

    "panama": "pa",

    "mexico": "mx",

    "nicaragua": "ni",

    "costa rica": "cr",

    "honduras": "hn",

    "guatemala": "gt",

    "el salvador": "sv",

    "belize": "bz",

    "bahamas": "bs",
    "the bahamas": "bs",

    "aruba": "aw",

    "curacao": "cw",
    "curaçao": "cw",

    "bonaire": "bq",

    "cuba": "cu",

    "haiti": "ht",

    "jamaica": "jm",

    "puerto rico": "pr",

    "brazil": "br",

    "peru": "pe",

    "ecuador": "ec",

    "argentina": "ar",

    "chile": "cl",

    "canada": "ca",

    "united states": "us",
    "usa": "us",
    "u.s.": "us",

    "spain": "es",

    "italy": "it",

    "germany": "de",

    "france": "fr",

    "netherlands": "nl",

    "australia": "au",

    "new zealand": "nz",

    "south korea": "kr",
    "korea": "kr",

    "japan": "jp",

    "taiwan": "tw",

    "china": "cn",

    "philippines": "ph"

  };


  return countryCodes[clean] || "";
}


/* =========================
   INTERNATIONAL HTML SAFETY
========================= */

function escapeInternationalHTML(
  value
) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================
   INTERNATIONAL NOTES / LEGEND
========================= */

function renderInternationalInfo(
  poolRow,
  year
) {

  const box =
    document.getElementById(
      "intlInfo"
    );


  if (!box) return;


  box.innerHTML = `

    <div class="draft-info-grid">

      <div>

        <h3>
          ${year} International Notes
        </h3>


        <p>
          <strong>
            Signing Period:
          </strong>

          ${get(
            poolRow,
            ["Signing Period"]
          ) || "N/A"}
        </p>


        <p>
          <strong>
            GM/POBO:
          </strong>

          ${get(
            poolRow,
            ["GM/POBO"]
          ) || "N/A"}
        </p>


        <p>
          <strong>
            International Scouting Director:
          </strong>

          ${get(
            poolRow,
            [
              "International Scouting Director"
            ]
          ) || "N/A"}
        </p>

      </div>


      <div>

        <h3>
          International Legend
        </h3>


        <div class="draft-legend">

          ${draftLegendRow(
            "CREW",
            "draft-tag-navy",
            "Player currently in Brewers organization"
          )}


          ${draftLegendRow(
            "DNS",
            "draft-tag-red",
            "Player did not sign with Brewers"
          )}


          ${draftLegendRow(
            "MLB",
            "draft-tag-navy",
            "Player has MLB experience with Brewers"
          )}


          ${draftLegendRow(
            "MLB",
            "draft-tag-yellow",
            "Player has MLB experience, not with Brewers"
          )}


          ${draftLegendRow(
            "Released",
            "draft-tag-light",
            "Player was released by Brewers"
          )}


          ${draftLegendRow(
            "Traded",
            "draft-tag-light",
            "Player was traded by Brewers"
          )}


          ${draftLegendRow(
            "Waived",
            "draft-tag-light",
            "Player was waived/DFA'd by Brewers"
          )}


          ${draftLegendRow(
            "FA",
            "draft-tag-light",
            "Player left Brewers as MLB free agent"
          )}


          ${draftLegendRow(
            "MLFA",
            "draft-tag-light",
            "Player left Brewers as minor league free agent"
          )}

        </div>


        <div class="draft-legend-notes">

          <p>
            <strong>Signing Bonus:</strong>
            Amount player signed for
          </p>


          <p>
            <strong>Pool Hit:</strong>
            Amount of Bonus $ counted towards Bonus Pool Cap
          </p>

        </div>

      </div>

    </div>
  `;
}
/* =========================
   ORGANIZATIONAL STATS
========================= */

let orgStatsType = "hitter";

let orgStatsRows = [];

let orgStatsBioMap = new Map();

let orgStatsSortColumn = "";

let orgStatsSortDirection = "desc";

let orgStatsShowMore = false;


/* =========================
   COLUMN DEFINITIONS
========================= */

const ORG_STATS_HITTER_COLUMNS = {

  primary: [
    "PlayerName",
    "PA",
    "H",
    "2B",
    "3B",
    "HR",
    "BB%",
    "K%",
    "OBP",
    "SLG",
    "OPS",
    "BABIP",
    "wOBA",
    "wRC+",
    "SB",
    "CS",
    "SB%",
    "SwStr%"
  ],

  more: [
    "Pull%",
    "Cent%",
    "Oppo%",
    "LD%",
    "GB%",
    "FB%",
    "IFFB%"
  ]

};

const ORG_STATS_PITCHER_COLUMNS = {

  primary: [
    "PlayerName",
    "G",
    "GS",
    "CG",
    "ShO",
    "SV",
    "BS",
    "IP",
    "ERA",
    "K%",
    "BB%",
    "K-BB%",
    "WHIP",
    "FIP",
    "xFIP",
    "K/9",
    "BB/9",
    "K/BB",
  ],

  more: [
    "SwStr%",
    "HR/9",
    "BABIP",
    "LOB%",
    "LD%",
    "GB%",
    "FB%",
    "IFFB%",
    "HR/FB"
  ]

};


/* =========================
   INITIALIZE
========================= */

async function initOrgStatsPage() {

  try {

    const bioRows =
      await loadSheet(
        "Biography Info"
      ).catch(() => []);


    buildOrgStatsBioMap(
      bioRows
    );


    setupOrgStatsListeners();


    await loadOrgStatsSheet();


  } catch (err) {

    console.error(
      "Organizational Stats:",
      err
    );


    const tbody =
      document.querySelector(
        "#orgStatsTable tbody"
      );


    if (tbody) {

      tbody.innerHTML = `
        <tr>
          <td>
            Unable to load organizational stats.
          </td>
        </tr>
      `;
    }
  }
}


/* =========================
   BIO / RANK MAP
========================= */

function buildOrgStatsBioMap(rows) {

  orgStatsBioMap =
    new Map();


  rows.forEach(row => {

    const name =
      get(row, [
        "Player",
        "Name"
      ]);


    if (!isRealValue(name)) {
      return;
    }


    const key =
      normalizeOrgStatsText(name);


    const playerID =
      get(row, [
        "Player-ID",
        "Player ID"
      ]);


    const rank =
      get(row, [
        "Rank"
      ]);


    const position =
      get(row, [
        "Position",
        "Pos"
      ]);


    orgStatsBioMap.set(
      key,
      {
        playerID,
        rank,
        position
      }
    );
  });
}


/* =========================
   NORMALIZE NAME
========================= */

function normalizeOrgStatsText(value) {

  return String(value || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}


/* =========================
   LOAD SELECTED SHEET
========================= */

async function loadOrgStatsSheet() {

  const year =
    document.getElementById(
      "orgStatsYear"
    )?.value || "2026";


  const sheetName =
    orgStatsType === "hitter"
      ? `Hitter Stats ${year}`
      : `Pitcher Stats ${year}`;


  const count =
    document.getElementById(
      "orgStatsCount"
    );


  if (count) {
    count.textContent =
      "Loading...";
  }


  try {

    const rows =
      await loadSheet(
        sheetName
      );


    orgStatsRows =
      rows.filter(row => {

        const name =
          get(row, [
            "PlayerName",
            "Player",
            "Name"
          ]);


        return isRealValue(name);
      });


    setupOrgStatsLevelFilter(
      orgStatsRows
    );


    setOrgStatsDefaultSort();


    renderOrgStats();

  } catch (err) {

    console.error(
      `Failed loading ${sheetName}:`,
      err
    );


    orgStatsRows = [];


    renderOrgStats();
  }
}


/* =========================
   DEFAULT SORT
========================= */

function setOrgStatsDefaultSort() {

  if (
    orgStatsType === "hitter"
  ) {

    orgStatsSortColumn =
      "wRC+";

    orgStatsSortDirection =
      "desc";

  } else {

    orgStatsSortColumn =
      "ERA";

    orgStatsSortDirection =
      "asc";
  }
}


/* =========================
   LEVEL FILTER
========================= */

function setupOrgStatsLevelFilter(rows) {

  const select =
    document.getElementById(
      "orgStatsLevel"
    );


  if (!select) return;


  const levels =
    new Set();


  rows.forEach(row => {

    const level =
      get(row, [
        "Level"
      ]);


    if (isRealValue(level)) {
      levels.add(
        String(level).trim()
      );
    }
  });


  const preferredOrder = [
    "AAA",
    "AA",
    "A+",
    "A",
    "ROK",
    "R",
    "ACL",
    "DSL"
  ];


  const sorted =
    [...levels]
      .sort((a, b) => {

        const ai =
          preferredOrder.indexOf(a);

        const bi =
          preferredOrder.indexOf(b);


        if (
          ai !== -1 ||
          bi !== -1
        ) {

          return (
            (ai === -1 ? 999 : ai) -
            (bi === -1 ? 999 : bi)
          );
        }


        return a.localeCompare(b);
      });


  select.innerHTML =
    `
      <option value="">
        All Levels
      </option>
    ` +

    sorted
      .map(level => `
        <option
          value="${escapeOrgStatsHTML(level)}"
        >
          ${escapeOrgStatsHTML(level)}
        </option>
      `)
      .join("");
}


/* =========================
   LISTENERS
========================= */

function setupOrgStatsListeners() {

  const hitterButton =
    document.getElementById(
      "orgStatsHittersButton"
    );


  const pitcherButton =
    document.getElementById(
      "orgStatsPitchersButton"
    );


  if (hitterButton) {

    hitterButton.addEventListener(
      "click",
      async () => {

        if (
          orgStatsType === "hitter"
        ) {
          return;
        }


        orgStatsType =
          "hitter";


        hitterButton.classList.add(
          "active"
        );


        pitcherButton?.classList.remove(
          "active"
        );


        updateOrgStatsMinimumLabel();


        await loadOrgStatsSheet();
      }
    );
  }


  if (pitcherButton) {

    pitcherButton.addEventListener(
      "click",
      async () => {

        if (
          orgStatsType === "pitcher"
        ) {
          return;
        }


        orgStatsType =
          "pitcher";


        pitcherButton.classList.add(
          "active"
        );


        hitterButton?.classList.remove(
          "active"
        );


        updateOrgStatsMinimumLabel();


        await loadOrgStatsSheet();
      }
    );
  }


  const year =
    document.getElementById(
      "orgStatsYear"
    );


  if (year) {

    year.addEventListener(
      "change",
      async () => {

        await loadOrgStatsSheet();
      }
    );
  }


  const search =
    document.getElementById(
      "orgStatsSearch"
    );


  if (search) {

    search.addEventListener(
      "input",
      renderOrgStats
    );
  }


  const level =
    document.getElementById(
      "orgStatsLevel"
    );


  if (level) {

    level.addEventListener(
      "change",
      renderOrgStats
    );
  }


  const minimum =
    document.getElementById(
      "orgStatsMinimum"
    );


  if (minimum) {

    minimum.addEventListener(
      "input",
      renderOrgStats
    );
  }


  const top50 =
    document.getElementById(
      "orgStatsTop50"
    );


  if (top50) {

    top50.addEventListener(
      "change",
      renderOrgStats
    );
  }


  const moreButton =
    document.getElementById(
      "orgStatsMoreButton"
    );


  if (moreButton) {

    moreButton.addEventListener(
      "click",
      () => {

        orgStatsShowMore =
          !orgStatsShowMore;


        moreButton.textContent =
          orgStatsShowMore
            ? "Fewer Stats"
            : "More Stats";


        moreButton.classList.toggle(
          "active",
          orgStatsShowMore
        );


        renderOrgStats();
      }
    );
  }
}


/* =========================
   MINIMUM LABEL
========================= */

function updateOrgStatsMinimumLabel() {

  const label =
    document.getElementById(
      "orgStatsMinLabel"
    );

  const minimum =
    document.getElementById(
      "orgStatsMinimum"
    );


  if (label) {
    label.textContent =
      orgStatsType === "hitter"
        ? "Min PA"
        : "Min IP";
  }


  if (minimum) {
    minimum.value = 1;
  }
}


/* =========================
   GET COLUMNS
========================= */

function getOrgStatsColumns() {

  const config =
    orgStatsType === "hitter"
      ? ORG_STATS_HITTER_COLUMNS
      : ORG_STATS_PITCHER_COLUMNS;


  if (!orgStatsShowMore) {

    return [
      ...config.primary
    ];
  }


  return [
    ...config.primary,
    ...config.more
  ];
}


/* =========================
   FILTER ROWS
========================= */

function getFilteredOrgStatsRows() {

  const search =
    normalizeOrgStatsText(
      document.getElementById(
        "orgStatsSearch"
      )?.value || ""
    );


  const level =
    document.getElementById(
      "orgStatsLevel"
    )?.value || "";


  const minimum =
  Number(
    document.getElementById(
      "orgStatsMinimum"
    )?.value || 1
  );


  const top50Only =
    document.getElementById(
      "orgStatsTop50"
    )?.checked || false;


  return orgStatsRows.filter(row => {

    const playerName =
      get(row, [
        "PlayerName",
        "Player",
        "Name"
      ]);


    const rowLevel =
      get(row, [
        "Level"
      ]);


    const normalizedName =
      normalizeOrgStatsText(
        playerName
      );


    if (
      search &&
      !normalizedName.includes(search)
    ) {
      return false;
    }


    if (
      level &&
      rowLevel !== level
    ) {
      return false;
    }


    if (minimum > 0) {

      if (orgStatsType === "hitter") {

        const pa =
          orgStatsNumber(
            get(row, ["PA"])
          );

        if (
          !Number.isFinite(pa) ||
          pa < minimum
        ) {
          return false;
        }

      } else {

        const ip =
          orgStatsInningsNumber(
            get(row, ["IP"])
          );

        if (
          !Number.isFinite(ip) ||
          ip < minimum
        ) {
          return false;
        }
      }
    }


    if (top50Only) {

      const bio =
        orgStatsBioMap.get(
          normalizedName
        );


      if (!bio) {
        return false;
      }


      const rank =
        Number(bio.rank);


      if (
        !Number.isFinite(rank) ||
        rank < 1 ||
        rank > 50
      ) {
        return false;
      }
    }


    return true;
  });
}


/* =========================
   SORT ROWS
========================= */

function sortOrgStatsRows(rows) {

  return [...rows]
    .sort((a, b) => {

      const column =
        orgStatsSortColumn;


      let aRaw =
        getOrgStatsCellValue(
          a,
          column
        );


      let bRaw =
        getOrgStatsCellValue(
          b,
          column
        );


      let comparison = 0;


      if (
        column === "PlayerName" ||
        column === "Level"
      ) {

        comparison =
          String(aRaw || "")
            .localeCompare(
              String(bRaw || ""),
              undefined,
              {
                sensitivity: "base"
              }
            );

      } else {

        const aNum =
          column === "IP"
            ? orgStatsInningsNumber(
                aRaw
              )
            : orgStatsNumber(
                aRaw
              );


        const bNum =
          column === "IP"
            ? orgStatsInningsNumber(
                bRaw
              )
            : orgStatsNumber(
                bRaw
              );


        const aValid =
          Number.isFinite(aNum);


        const bValid =
          Number.isFinite(bNum);


        if (
          !aValid &&
          !bValid
        ) {
          comparison = 0;

        } else if (!aValid) {
          comparison = 1;

        } else if (!bValid) {
          comparison = -1;

        } else {
          comparison =
            aNum - bNum;
        }
      }


      return (
        orgStatsSortDirection ===
        "asc"
          ? comparison
          : -comparison
      );
    });
}


/* =========================
   RENDER
========================= */

function renderOrgStats() {

  const table =
    document.getElementById(
      "orgStatsTable"
    );


  if (!table) return;


  const columns =
    getOrgStatsColumns();


  const filtered =
    getFilteredOrgStatsRows();


  const sorted =
    sortOrgStatsRows(
      filtered
    );


  renderOrgStatsHeader(
    table,
    columns
  );


  renderOrgStatsBody(
    table,
    columns,
    sorted
  );


  const count =
    document.getElementById(
      "orgStatsCount"
    );


  if (count) {

    count.textContent =
      `${sorted.length.toLocaleString()} player${sorted.length === 1 ? "" : "s"}`;
  }
}


/* =========================
   TABLE HEADER
========================= */

function renderOrgStatsHeader(
  table,
  columns
) {

  const thead =
    table.querySelector(
      "thead"
    );


  if (!thead) return;


  thead.innerHTML = `
    <tr>

      ${columns.map(column => {

        const active =
          orgStatsSortColumn ===
          column;


        let arrow = "";


        if (active) {

          arrow =
            orgStatsSortDirection ===
            "asc"
              ? " ▲"
              : " ▼";
        }


        return `
          <th
            class="org-stats-sortable ${
              active
                ? "org-stats-sorted"
                : ""
            }"
            data-stat="${escapeOrgStatsHTML(column)}"
          >
            ${escapeOrgStatsHTML(
              getOrgStatsColumnLabel(
                column
              )
            )}${arrow}
          </th>
        `;
      }).join("")}

    </tr>
  `;


  thead
    .querySelectorAll(
      "[data-stat]"
    )
    .forEach(th => {

      th.addEventListener(
        "click",
        () => {

          const column =
            th.dataset.stat;


          if (
            orgStatsSortColumn ===
            column
          ) {

            orgStatsSortDirection =
              orgStatsSortDirection ===
              "asc"
                ? "desc"
                : "asc";

          } else {

            orgStatsSortColumn =
              column;


            orgStatsSortDirection =
              getOrgStatsDefaultDirection(
                column
              );
          }


          renderOrgStats();
        }
      );
    });
}


/* =========================
   DEFAULT SORT DIRECTION
========================= */

function getOrgStatsDefaultDirection(
  column
) {

  const lowerIsBetter = [
    "ERA",
    "FIP",
    "xFIP",
    "WHIP",
    "BB%",
    "BB/9",
  ];


  if (
    orgStatsType === "pitcher" &&
    lowerIsBetter.includes(column)
  ) {
    return "asc";
  }


  if (
    column === "PlayerName" ||
    column === "Level"
  ) {
    return "asc";
  }


  return "desc";
}


/* =========================
   TABLE BODY
========================= */

function renderOrgStatsBody(
  table,
  columns,
  rows
) {

  const tbody =
    table.querySelector(
      "tbody"
    );


  if (!tbody) return;


  if (!rows.length) {

    tbody.innerHTML = `
      <tr>
        <td
          colspan="${columns.length}"
          class="org-stats-empty"
        >
          No players match those filters.
        </td>
      </tr>
    `;

    return;
  }


  tbody.innerHTML =
    rows.map(row => {

      return `
        <tr>

          ${columns.map(column => {

            if (
              column ===
              "PlayerName"
            ) {

              return `
                <td class="org-stats-player-cell">
                  ${renderOrgStatsPlayer(row)}
                </td>
              `;
            }


            const value =
              getOrgStatsCellValue(
                row,
                column
              );


            return `
              <td>
                ${escapeOrgStatsHTML(value)}
              </td>
            `;

          }).join("")}

        </tr>
      `;

    }).join("");
}


/* =========================
   PLAYER CELL
========================= */

function renderOrgStatsPlayer(row) {

  const playerName =
    get(row, [
      "PlayerName",
      "Player",
      "Name"
    ]);


  const normalized =
    normalizeOrgStatsText(
      playerName
    );


  const bio =
    orgStatsBioMap.get(
      normalized
    );


  const statsPlayerID =
    get(row, [
      "Player ID",
      "Player-ID"
    ]);


  const archived =
    String(
      get(row, [
        "Archived?",
        "Archived",
        "Archive"
      ])
    )
      .toLowerCase()
      .trim() === "yes";


  const playerID =
    isRealValue(statsPlayerID)
      ? statsPlayerID
      : bio?.playerID || "";


  let nameHTML =
    escapeOrgStatsHTML(
      playerName
    );


  if (
    isRealValue(playerID)
  ) {

    const href =
      `${archived
        ? "archive-player.html"
        : "player.html"
      }?id=${encodeURIComponent(playerID)}`;


    nameHTML = `
      <a
        class="org-stats-player-link"
        href="${href}"
      >
        ${escapeOrgStatsHTML(playerName)}
      </a>
    `;
  }


  let rankHTML = "";


  if (
    bio &&
    isRealValue(bio.rank)
  ) {

    const rank =
      Number(bio.rank);


    if (
      Number.isFinite(rank)
    ) {

      rankHTML = `
        <span
          class="org-stats-rank ${
            rank <= 50
              ? "org-stats-rank-top50"
              : "org-stats-rank-other"
          }"
        >
          #${escapeOrgStatsHTML(
            bio.rank
          )}
        </span>
      `;
    }
  }


  return `
    <div class="org-stats-player-wrap">

      ${nameHTML}

      ${rankHTML}

    </div>
  `;
}


/* =========================
   GET CELL VALUE
========================= */

function getOrgStatsCellValue(row, column) {

  const aliases = {

    PlayerName: [
      "PlayerName",
      "Player Name",
      "Player",
      "Name"
    ],

    Level: [
      "Level"
    ],

    PA: [
      "PA",
      "Plate Appearances"
    ],

    H: [
      "H",
      "Hits"
    ],

    "1B": [
      "1B",
      "Singles"
    ],

    "2B": [
      "2B",
      "Doubles"
    ],

    "3B": [
      "3B",
      "Triples"
    ],

    HR: [
      "HR",
      "Home Runs"
    ],

    "BB%": [
      "BB%",
      "BB %",
      "BBPct"
    ],

    "K%": [
      "K%",
      "K %",
      "KPct"
    ],

    OBP: [
      "OBP"
    ],

    SLG: [
      "SLG"
    ],

    OPS: [
      "OPS"
    ],

    BABIP: [
      "BABIP"
    ],

    Spd: [
      "Spd",
      "Speed"
    ],

    wOBA: [
      "wOBA"
    ],

    "wRC+": [
      "wRC+",
      "wRC Plus"
    ],

    SB: [
      "SB",
      "Stolen Bases"
    ],

    CS: [
      "CS",
      "Caught Stealing"
    ],

    "Pull%": [
      "Pull%",
      "Pull %",
      "Pull"
    ],

    "Cent%": [
      "Cent%",
      "Cent %",
      "Center%",
      "Center %",
      "Cent"
    ],

    "Oppo%": [
      "Oppo%",
      "Oppo %",
      "Opposite%",
      "Opposite %"
    ],

    "LD%": [
      "LD%",
      "LD %",
      "Line Drive%"
    ],

    "GB%": [
      "GB%",
      "GB %",
      "Ground Ball%"
    ],

    "FB%": [
      "FB%",
      "FB %",
      "Fly Ball%"
    ],

    "IFFB%": [
      "IFFB%",
      "IFFB %",
      "Infield Fly%"
    ],

    "SwStr%": [
      "SwStr%",
      "SwStr %",
      "SwStr",
      "Swinging Strike%"
    ],

    IP: [
      "IP",
      "Innings Pitched"
    ],

    ERA: [
      "ERA"
    ],

    G: [
      "G"
    ],

    GS: [
      "GS"
    ],

    CG: [
      "CG"
    ],

    ShO: [
      "ShO",
      "SHO"
    ],

    SV: [
      "SV"
    ],

    BS: [
      "BS"
    ],

    "K/9": [
      "K/9"
    ],

    "BB/9": [
      "BB/9"
    ],

    "K/BB": [
      "K/BB"
    ],

    "HR/9": [
      "HR/9"
    ],

    "K-BB%": [
      "K-BB%",
      "K-BB %",
      "K-BB"
    ],

    WHIP: [
      "WHIP"
    ],

    "LOB%": [
      "LOB%",
      "LOB %"
    ],

    FIP: [
      "FIP"
    ],

    xFIP: [
      "xFIP"
    ],

    "HR/FB": [
      "HR/FB",
      "HR/FB%"
    ]

  };


  const keys =
    aliases[column] || [column];


  return get(
    row,
    keys
  );
}

/* =========================
   COLUMN LABEL
========================= */

function getOrgStatsColumnLabel(
  column
) {

  if (
    column === "PlayerName"
  ) {
    return "Player";
  }


  return column;
}


/* =========================
   NUMERIC PARSING
========================= */

function orgStatsNumber(value) {

  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return NaN;
  }


  const cleaned =
    String(value)
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim();


  const number =
    Number(cleaned);


  return Number.isFinite(number)
    ? number
    : NaN;
}


/* =========================
   BASEBALL IP PARSING

   12.1 = 12 1/3 innings
   12.2 = 12 2/3 innings
========================= */

function orgStatsInningsNumber(value) {

  const raw =
    String(value || "")
      .trim();


  if (!raw) {
    return NaN;
  }


  const parts =
    raw.split(".");


  const whole =
    Number(parts[0]);


  if (
    !Number.isFinite(whole)
  ) {
    return NaN;
  }


  if (
    parts.length === 1
  ) {
    return whole;
  }


  const outs =
    Number(parts[1]);


  if (outs === 1) {
    return whole + (1 / 3);
  }


  if (outs === 2) {
    return whole + (2 / 3);
  }


  return Number(raw);
}


/* =========================
   HTML SAFETY
========================= */

function escapeOrgStatsHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
/* =========================
   TRANSACTIONS
========================= */

let transactionRows = [];
let transactionVisibleCount = 50;


/* =========================
   INITIALIZE
========================= */

async function initTransactionsPage() {
  try {

    const rows = await loadSheet("Transactions");

    transactionRows = rows.filter(row =>
      isRealValue(get(row, ["Player"])) ||
      isRealValue(get(row, ["Description"]))
    );

    setupTransactionFilters(transactionRows);
    setupTransactionListeners();

    renderTransactions();

  } catch (err) {

    console.error("Transactions page:", err);

    const list =
      document.getElementById("transactionsList");

    if (list) {
      list.innerHTML = `
        <section class="card">
          Unable to load transactions.
        </section>
      `;
    }
  }
}


/* =========================
   CLEAN TRANSACTION TYPE
========================= */

function getCleanTransactionType(row) {

  const rawType =
    String(get(row, ["Type"]) || "")
      .trim();

  const rawTypeLower =
    rawType.toLowerCase();

  const description =
    String(get(row, ["Description"]) || "")
      .toLowerCase()
      .trim();

  const fromTeam =
    String(get(row, ["From Team"]) || "")
      .toLowerCase()
      .trim();

  const toTeam =
    String(get(row, ["To Team"]) || "")
      .toLowerCase()
      .trim();


  /* =========================
     BREWERS MINOR LEAGUE LADDER
  ========================= */

  const affiliateLevels = [

    /* 0 - DSL */
    [
      "dsl",
      "dsl brewers",
      "dominican summer league"
    ],

    /* 1 - ACL */
    [
      "acl",
      "acl brewers",
      "arizona complex",
      "arizona complex league"
    ],

    /* 2 - Wilson */
    [
      "wilson",
      "wilson warbirds"
    ],

    /* 3 - Wisconsin */
    [
      "wisconsin",
      "wisconsin timber rattlers",
      "timber rattlers"
    ],

    /* 4 - Biloxi */
    [
      "biloxi",
      "biloxi shuckers",
      "shuckers"
    ],

    /* 5 - Nashville */
    [
      "nashville",
      "nashville sounds",
      "sounds"
    ]
  ];


  function getAffiliateIndex(team) {

    if (!team) return -1;

    return affiliateLevels.findIndex(names =>
      names.some(name =>
        team.includes(name)
      )
    );
  }


  const fromIndex =
    getAffiliateIndex(fromTeam);

  const toIndex =
    getAffiliateIndex(toTeam);


  /* =========================
     PROMOTION / DEMOTION

     Check this BEFORE Assigned,
     because MiLB promotions often
     say "assigned to..."
  ========================= */

  if (
    fromIndex !== -1 &&
    toIndex !== -1 &&
    fromIndex !== toIndex
  ) {

    if (toIndex > fromIndex) {
      return "Promotion";
    }

    if (toIndex < fromIndex) {
      return "Demotion";
    }
  }


  /* =========================
     CONTRACT SELECTED
  ========================= */

  if (
    description.includes("selected the contract") ||
    description.includes("contract selected") ||
    description.includes("selected contract") ||
    rawTypeLower.includes("contract selected")
  ) {
    return "Contract Selected";
  }


  /* =========================
     RECALLED
  ========================= */

  if (
    description.includes("recalled") ||
    rawTypeLower.includes("recalled")
  ) {
    return "Recalled";
  }


  /* =========================
     OPTIONED
  ========================= */

  if (
    description.includes("optioned") ||
    rawTypeLower.includes("optioned")
  ) {
    return "Optioned";
  }


  /* =========================
     ACTIVATED
  ========================= */

  if (
    description.includes("activated") ||
    rawTypeLower.includes("activated")
  ) {
    return "Activated";
  }


  /* =========================
     INJURED LIST
  ========================= */

  if (
    description.includes("injured list") ||
    description.includes("disabled list") ||
    description.includes("placed on the il") ||
    description.includes("placed on il") ||
    rawTypeLower.includes("injured list") ||
    rawTypeLower === "il"
  ) {
    return "Injured List";
  }


  /* =========================
     DFA
  ========================= */

  if (
    description.includes("designated for assignment") ||
    rawTypeLower.includes("designated for assignment") ||
    rawTypeLower === "dfa"
  ) {
    return "DFA";
  }


  /* =========================
     WAIVED
  ========================= */

  if (
    description.includes("waived") ||
    description.includes("placed on waivers") ||
    rawTypeLower.includes("waived")
  ) {
    return "Waived";
  }


  /* =========================
     CLAIMED
  ========================= */

  if (
    description.includes("claimed off waivers") ||
    description.includes("claimed by") ||
    rawTypeLower.includes("claimed")
  ) {
    return "Claimed";
  }


  /* =========================
     OUTRIGHTED
  ========================= */

  if (
    description.includes("outrighted") ||
    rawTypeLower.includes("outright")
  ) {
    return "Outrighted";
  }


  /* =========================
     TRADED
  ========================= */

  if (
    description.includes("traded") ||
    rawTypeLower.includes("trade")
  ) {
    return "Traded";
  }


  /* =========================
     RELEASED
  ========================= */

  if (
    description.includes("released") ||
    rawTypeLower.includes("released")
  ) {
    return "Released";
  }


  /* =========================
     FREE AGENCY
  ========================= */

  if (
    description.includes("elected free agency") ||
    description.includes("declared free agency") ||
    description.includes("became a free agent") ||
    rawTypeLower.includes("free agent") ||
    rawTypeLower.includes("free agency")
  ) {
    return "Free Agency";
  }


  /* =========================
     SIGNED
  ========================= */

  if (
    description.includes("signed") &&
    !description.includes("assigned")
  ) {
    return "Signed";
  }

  if (
    rawTypeLower.includes("signed") &&
    !description.includes("assigned")
  ) {
    return "Signed";
  }


  /* =========================
     ASSIGNED

     Important: this comes AFTER
     promotion/demotion detection.
  ========================= */

  if (
    description.includes("assigned") ||
    rawTypeLower === "assigned"
  ) {
    return "Assigned";
  }


  /* =========================
     SUSPENDED
  ========================= */

  if (
    description.includes("suspended") ||
    rawTypeLower.includes("suspended")
  ) {
    return "Suspended";
  }


  /* =========================
     RETIRED
  ========================= */

  if (
    description.includes("retired") ||
    description.includes("voluntarily retired") ||
    rawTypeLower.includes("retired")
  ) {
    return "Retired";
  }


  /* =========================
     DEFAULT

     Keep original type if we
     haven't classified it yet.
  ========================= */

  return rawType || "Other";
}


/* =========================
   FILTER SETUP
========================= */

function setupTransactionFilters(rows) {

  const years = new Set();
  const levels = new Set();
  const affiliates = new Set();
  const types = new Set();


  rows.forEach(row => {

    const date =
      parseTransactionDate(
        get(row, ["Date", "Effective Date"])
      );

    if (date) {
      years.add(date.getFullYear());
    }


    const level =
      get(row, ["Level"]);

    if (isRealValue(level)) {
      levels.add(level);
    }


    const fromTeam =
      get(row, ["From Team"]);

    const toTeam =
      get(row, ["To Team"]);

    if (isRealValue(fromTeam)) {
      affiliates.add(fromTeam);
    }

    if (isRealValue(toTeam)) {
      affiliates.add(toTeam);
    }


    /* Use CLEAN transaction type */
    const type =
      getCleanTransactionType(row);

    if (isRealValue(type)) {
      types.add(type);
    }
  });


  /* =========================
     YEAR
  ========================= */

  const yearSelect =
    document.getElementById(
      "transactionYear"
    );

  if (yearSelect) {

    yearSelect.innerHTML =
      `<option value="">All Years</option>` +

      [...years]
        .sort((a, b) => b - a)
        .map(year => `
          <option value="${year}">
            ${year}
          </option>
        `)
        .join("");
  }


  /* =========================
     LEVEL
  ========================= */

  const levelSelect =
    document.getElementById(
      "transactionLevel"
    );

  if (levelSelect) {

    const preferredOrder = [
      "MLB",
      "AAA",
      "AA",
      "A+",
      "A",
      "ROK",
      "CPX",
      "DSL"
    ];


    const sortedLevels =
      [...levels].sort((a, b) => {

        const ai =
          preferredOrder.indexOf(a);

        const bi =
          preferredOrder.indexOf(b);

        if (ai !== -1 || bi !== -1) {

          return (
            (ai === -1 ? 999 : ai) -
            (bi === -1 ? 999 : bi)
          );
        }

        return a.localeCompare(b);
      });


    levelSelect.innerHTML =
      `<option value="">All Levels</option>` +

      sortedLevels
        .map(level => `
          <option value="${escapeTransactionHTML(level)}">
            ${escapeTransactionHTML(level)}
          </option>
        `)
        .join("");
  }


  /* =========================
     AFFILIATE
  ========================= */

  const affiliateSelect =
    document.getElementById(
      "transactionAffiliate"
    );

  if (affiliateSelect) {

    affiliateSelect.innerHTML =
      `<option value="">All Affiliates</option>` +

      [...affiliates]
        .sort((a, b) =>
          a.localeCompare(b)
        )
        .map(team => `
          <option value="${escapeTransactionHTML(team)}">
            ${escapeTransactionHTML(team)}
          </option>
        `)
        .join("");
  }


  /* =========================
     TRANSACTION TYPE
  ========================= */

  const typeSelect =
    document.getElementById(
      "transactionType"
    );

  if (typeSelect) {

    const preferredTypes = [
      "Promotion",
      "Demotion",
      "Recalled",
      "Optioned",
      "Contract Selected",
      "Assigned",
      "Signed",
      "Activated",
      "Injured List",
      "Traded",
      "Released",
      "DFA",
      "Waived",
      "Claimed",
      "Outrighted",
      "Free Agency",
      "Suspended",
      "Retired"
    ];


    const sortedTypes =
      [...types].sort((a, b) => {

        const ai =
          preferredTypes.indexOf(a);

        const bi =
          preferredTypes.indexOf(b);

        if (ai !== -1 || bi !== -1) {

          return (
            (ai === -1 ? 999 : ai) -
            (bi === -1 ? 999 : bi)
          );
        }

        return a.localeCompare(b);
      });


    typeSelect.innerHTML =
      `<option value="">All Transaction Types</option>` +

      sortedTypes
        .map(type => `
          <option value="${escapeTransactionHTML(type)}">
            ${escapeTransactionHTML(type)}
          </option>
        `)
        .join("");
  }
}


/* =========================
   FILTER LISTENERS
========================= */

function setupTransactionListeners() {

  const ids = [
    "transactionSearch",
    "transactionYear",
    "transactionMonth",
    "transactionOrgLevel",
    "transactionAffiliate",
    "transactionType",
    "transactionSort"
  ];


  ids.forEach(id => {

    const el =
      document.getElementById(id);

    if (!el) return;


    el.addEventListener(
      "input",
      () => {

        transactionVisibleCount = 50;

        renderTransactions();
      }
    );


    el.addEventListener(
      "change",
      () => {

        transactionVisibleCount = 50;

        renderTransactions();
      }
    );
  });


  const loadMore =
    document.getElementById(
      "transactionsLoadMore"
    );


  if (loadMore) {

    loadMore.addEventListener(
      "click",
      () => {

        transactionVisibleCount += 50;

        renderTransactions();
      }
    );
  }
}


/* =========================
   FILTER TRANSACTIONS
========================= */

function getFilteredTransactions() {

  const search =
    String(
      document.getElementById(
        "transactionSearch"
      )?.value || ""
    )
      .toLowerCase()
      .trim();


  const year =
    document.getElementById(
      "transactionYear"
    )?.value || "";


  const month =
    document.getElementById(
      "transactionMonth"
    )?.value ?? "";


  const orgLevel =
    document.getElementById(
      "transactionOrgLevel"
    )?.value || "";


  const affiliate =
    document.getElementById(
      "transactionAffiliate"
    )?.value || "";


  const type =
    document.getElementById(
      "transactionType"
    )?.value || "";


  const sort =
    document.getElementById(
      "transactionSort"
    )?.value || "newest";


  const filtered =
    transactionRows.filter(row => {

      const player =
        String(
          get(row, ["Player"])
        )
          .toLowerCase();


      const description =
        String(
          get(row, ["Description"])
        )
          .toLowerCase();


      const rowLevel =
        get(row, ["Level"]);


      /* Use cleaned type */
      const rowType =
        getCleanTransactionType(row);


      const fromTeam =
        get(row, ["From Team"]);


      const toTeam =
        get(row, ["To Team"]);


      const date =
        parseTransactionDate(
          get(row, ["Date", "Effective Date"])
        );


      /* Search */

      if (
        search &&
        !player.includes(search) &&
        !description.includes(search)
      ) {
        return false;
      }


      /* Year */

      if (
        year &&
        (
          !date ||
          String(date.getFullYear()) !== year
        )
      ) {
        return false;
      }


      /* Month */

      if (
        month !== "" &&
        (
          !date ||
          String(date.getMonth()) !== month
        )
      ) {
        return false;
      }


      /* MLB only */

      if (orgLevel === "MLB") {

        if (
          String(rowLevel)
            .toUpperCase()
            .trim() !== "MLB"
        ) {
          return false;
        }
      }


      /* MiLB only */

      if (orgLevel === "MiLB") {

        if (
          String(rowLevel)
            .toUpperCase()
            .trim() === "MLB"
        ) {
          return false;
        }
      }
      

      /* Affiliate */

      if (
        affiliate &&
        fromTeam !== affiliate &&
        toTeam !== affiliate
      ) {
        return false;
      }


      /* Clean transaction type */

      if (
        type &&
        rowType !== type
      ) {
        return false;
      }


      return true;
    });


  /* =========================
     SORT
  ========================= */

  filtered.sort((a, b) => {

    const dateA =
      parseTransactionDate(
        get(a, ["Date", "Effective Date"])
      );

    const dateB =
      parseTransactionDate(
        get(b, ["Date", "Effective Date"])
      );


    const aTime =
      dateA
        ? dateA.getTime()
        : 0;


    const bTime =
      dateB
        ? dateB.getTime()
        : 0;


    return sort === "oldest"
      ? aTime - bTime
      : bTime - aTime;
  });


  return filtered;
}


/* =========================
   RENDER
========================= */

function renderTransactions() {

  const list =
    document.getElementById(
      "transactionsList"
    );

  if (!list) return;


  const filtered =
    getFilteredTransactions();


  const visible =
    filtered.slice(
      0,
      transactionVisibleCount
    );


  const count =
    document.getElementById(
      "transactionCount"
    );


  if (count) {

    count.textContent =
      `${filtered.length.toLocaleString()} transaction${filtered.length === 1 ? "" : "s"}`;
  }


  if (!filtered.length) {

    list.innerHTML = `
      <section class="card transactions-empty">
        No transactions match those filters.
      </section>
    `;

  } else {

    list.innerHTML =
      visible
        .map(renderTransactionRow)
        .join("");
  }


  const loadMore =
    document.getElementById(
      "transactionsLoadMore"
    );


  if (loadMore) {

    if (
      transactionVisibleCount >=
      filtered.length
    ) {

      loadMore.style.display =
        "none";

    } else {

      loadMore.style.display =
        "inline-block";


      loadMore.textContent =
        `Load More (${filtered.length - transactionVisibleCount} remaining)`;
    }
  }
}


/* =========================
   TRANSACTION ROW
========================= */

function renderTransactionRow(row) {

  const player =
    get(row, ["Player"]);


  /* =========================
     BACKFIELD BREW PLAYER ID
  ========================= */

  const playerIDRaw =
    get(row, [
      "Player ID",
      "Player-ID"
    ]);


  const playerID =
    String(playerIDRaw || "")
      .trim()
      .replace(/^""$/, "");


  /* =========================
     MLBAM ID
  ========================= */

  const mlbamIDRaw =
    get(row, [
      "MLBAM ID",
      "MLBAM-ID",
      "MLBAM",
      "MLB ID"
    ]);


  const mlbamID =
    String(mlbamIDRaw || "")
      .trim()
      .replace(/[^0-9]/g, "");


  /* =========================
     ARCHIVED?
  ========================= */

  const archived =
    String(
      get(row, [
        "Archived?",
        "Archived"
      ])
    )
      .toLowerCase()
      .trim() === "yes";


  const position =
    get(row, ["Position"]);


  const level =
    get(row, ["Level"]);


  /* CLEANED TYPE */
  const type =
    getCleanTransactionType(row);


  const description =
    get(row, ["Description"]);


  const fromTeam =
    get(row, ["From Team"]);


  const toTeam =
    get(row, ["To Team"]);


  const sourceURL =
    cleanUrl(
      get(row, ["Source URL"])
    );


  const date =
    parseTransactionDate(
      get(row, ["Date", "Effective Date"])
    );


  /* =========================
     PLAYER LINK
  ========================= */

  let playerHTML =
    escapeTransactionHTML(player);


  /* Backfield Brew page */
  if (playerID !== "") {

    const href =
      `${
        archived
          ? "archive-player.html"
          : "player.html"
      }?id=${encodeURIComponent(playerID)}`;


    playerHTML = `
      <a
        class="transaction-player"
        href="${href}"
      >
        ${escapeTransactionHTML(player)}
      </a>
    `;


  /* MLBAM fallback */
  } else if (mlbamID !== "") {

    playerHTML = `
      <a
        class="transaction-player transaction-player-mlbam"
        href="https://www.mlb.com/player/${mlbamID}"
        target="_blank"
        rel="noopener"
      >
        ${escapeTransactionHTML(player)}
      </a>
    `;
  }


  /* =========================
     RENDER TRANSACTION
  ========================= */

  return `
    <section class="card transaction-card">


      <div class="transaction-top">

        <div class="transaction-date">
          ${formatTransactionDisplayDate(date)}
        </div>

        <div class="transaction-type">
          ${escapeTransactionHTML(type)}
        </div>

      </div>


      <div class="transaction-player-row">

        ${
          isRealValue(position)
            ? `
              <span class="transaction-position">
                ${escapeTransactionHTML(position)}
              </span>
            `
            : ""
        }


        ${playerHTML}


        ${
          isRealValue(level)
            ? `
              <span class="transaction-level">
                ${escapeTransactionHTML(level)}
              </span>
            `
            : ""
        }

      </div>


      ${
        isRealValue(fromTeam) ||
        isRealValue(toTeam)

          ? `
            <div class="transaction-movement">

              ${
                isRealValue(fromTeam)
                  ? `
                    <span>
                      ${escapeTransactionHTML(fromTeam)}
                    </span>
                  `
                  : `<span>—</span>`
              }


              <span class="transaction-arrow">
                →
              </span>


              ${
                isRealValue(toTeam)
                  ? `
                    <span>
                      ${escapeTransactionHTML(toTeam)}
                    </span>
                  `
                  : `<span>—</span>`
              }

            </div>
          `

          : ""
      }


      ${
        isRealValue(description)

          ? `
            <div class="transaction-description">
              ${escapeTransactionHTML(description)}
            </div>
          `

          : ""
      }


      ${
        isRealValue(sourceURL)

          ? `
            <div class="transaction-source">

              <a
                href="${sourceURL}"
                target="_blank"
                rel="noopener"
              >
                View Source
              </a>

            </div>
          `

          : ""
      }


    </section>
  `;
}


/* =========================
   DATE HELPERS
========================= */

function parseTransactionDate(value) {

  if (!isRealValue(value)) {
    return null;
  }


  const raw =
    String(value).trim();


  /* Google Sheets serial date */

  const numeric =
    Number(raw);


  if (
    Number.isFinite(numeric) &&
    numeric > 20000 &&
    numeric < 100000
  ) {

    return new Date(
      (numeric - 25569) *
      86400 *
      1000
    );
  }


  /* YYYY-MM-DD */

  const iso =
    raw.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})/
    );


  if (iso) {

    return new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3])
    );
  }


  /* MM/DD/YYYY */

  const slash =
    raw.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
    );


  if (slash) {

    return new Date(
      Number(slash[3]),
      Number(slash[1]) - 1,
      Number(slash[2])
    );
  }


  const parsed =
    new Date(raw);


  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}


function formatTransactionDisplayDate(date) {

  if (!date) return "";


  return (
    `${date.getMonth() + 1}/` +
    `${date.getDate()}/` +
    `${date.getFullYear()}`
  );
}


/* =========================
   HTML SAFETY
========================= */

function escapeTransactionHTML(value) {

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
/* =========================
   Rule 5
========================= */

async function initRule5Page() {
  try {
    const rows = await loadSheet("Rule 5 Eligibility");
    const freeAgencyRows = await loadSheet("MiLB Free Agency").catch(() => []);

    renderRule5Page(rows, freeAgencyRows);
  } catch (err) {
    console.error("Rule 5 page:", err);
  }
}

function renderRule5Page(rows, freeAgencyRows = []) {
  const grid = document.getElementById("rule5Grid");
  if (!grid || !rows.length) return;

  const years = Object.keys(rows[0]).filter(year =>
    /^\d{4}$/.test(String(year).trim())
  );

  grid.innerHTML = years.map(year => {
    const freeAgentsForYear = new Set(
      freeAgencyRows
        .map(row => get(row, [year]))
        .filter(isRealValue)
        .map(name => String(name).trim().toLowerCase())
    );

    const players = rows
      .map(row => ({
        name: get(row, [year]),
        playerID: get(row, [
          `${year} Player ID`,
          `${year} Player-ID`,
          `${year} ID`
        ])
      }))
      .filter(p => isRealValue(p.name))
      .filter(p => !freeAgentsForYear.has(String(p.name).trim().toLowerCase()));

    return `
      <div class="rule5-year">
        <h3>December ${year}</h3>

        <ul>
          ${players.map(player => `
            <li>
              ${isRealValue(player.playerID)
                ? `<a href="player.html?id=${encodeURIComponent(player.playerID)}">${player.name}</a>`
                : player.name
              }
            </li>
          `).join("")}
        </ul>
      </div>
    `;
  }).join("");
}
/* =========================
   MiLB Free Agency
========================= */
async function initFreeAgencyPage() {
  try {
    const rows = await loadSheet("MiLB Free Agency");
    renderFreeAgencyPage(rows);
  } catch (err) {
    console.error("MiLB Free Agency page:", err);
  }
}

function renderFreeAgencyPage(rows) {
  const grid = document.getElementById("freeAgencyGrid");
  if (!grid || !rows.length) return;

  const years = Object.keys(rows[0]).filter(year =>
    /^\d{4}$/.test(String(year).trim())
  );

  grid.innerHTML = years.map(year => {
    const players = rows
      .map(row => ({
        name: get(row, [year]),
        playerID: get(row, [
          `${year} Player ID`,
          `${year} Player-ID`,
          `${year} ID`
        ])
      }))
      .filter(p => isRealValue(p.name));

    return `
      <div class="rule5-year">
        <h3>November ${year}</h3>
        <ul>
          ${players.map(player => `
            <li>
              ${isRealValue(player.playerID)
                ? `<a href="player.html?id=${encodeURIComponent(player.playerID)}">${player.name}</a>`
                : player.name
              }
            </li>
          `).join("")}
        </ul>
      </div>
    `;
  }).join("");
}
/* =========================
   Compare Page
========================= */
async function initComparePage() {
  try {
    const players = await loadSheet("Biography Info");
    const hitterTools = await loadSheet("Hitter Tools").catch(() => []);
    const pitcherTools = await loadSheet("Pitcher Tools").catch(() => []);

    window.compareData = {
      players,
      tools: [...hitterTools, ...pitcherTools]
    };

    const cleanPlayers = players
      .filter(p => isRealValue(get(p, ["Player-ID", "Player ID"])) && isRealValue(get(p, ["Player", "Name"])))
      .sort((a, b) => num(get(a, ["Rank"])) - num(get(b, ["Rank"])));

    populateCompareDropdown("comparePlayer1", cleanPlayers);
    populateCompareDropdown("comparePlayer2", cleanPlayers);

    document.getElementById("comparePlayer1")?.addEventListener("change", renderComparePlayers);
    document.getElementById("comparePlayer2")?.addEventListener("change", renderComparePlayers);
  } catch (err) {
    console.error("Compare page:", err);
  }
}

function populateCompareDropdown(id, players) {
  const select = document.getElementById(id);
  if (!select) return;

  select.innerHTML =
    `<option value="">Select player...</option>` +
    players.map(p => `
      <option value="${get(p, ["Player-ID", "Player ID"])}">
        #${get(p, ["Rank"])} ${get(p, ["Player", "Name"])}
      </option>
    `).join("");
}

function renderComparePlayers() {
  const id1 = document.getElementById("comparePlayer1")?.value;
  const id2 = document.getElementById("comparePlayer2")?.value;
  const output = document.getElementById("compareOutput");

  if (!output || !window.compareData) return;

  if (!id1 || !id2) {
    output.innerHTML = "";
    return;
  }

  const player1 = findComparePlayer(id1);
  const player2 = findComparePlayer(id2);

  if (!player1 || !player2) return;

  output.innerHTML = `
    <div class="compare-grid">
      ${renderCompareCard(player1)}
      ${renderCompareCard(player2)}
    </div>
  `;
}

function findComparePlayer(id) {
  const bio = window.compareData.players.find(p =>
    get(p, ["Player-ID", "Player ID"]) === id
  );

  const tools = window.compareData.tools.find(t =>
    get(t, ["Player-ID", "Player ID"]) === id
  );

  return { bio, tools };
}

function renderCompareCard(player) {
  const bio = player.bio;
  const tools = player.tools || {};
  const playerID = get(bio, ["Player-ID", "Player ID"]);
  const name = get(bio, ["Player", "Name"]);
  const picture = get(bio, ["Picture", "Image", "Photo", "Picture URL", "Image URL"]);

  const isPitcher = get(bio, ["Player Type"]).toLowerCase().includes("pitch");

  const toolKeys = isPitcher
  ? [
      "Primary Pitch", "Pitch #1",
      "Secondary #1", "Pitch #2",
      "Secondary #2", "Pitch #3",
      "Secondary #3", "Pitch #4",
      "Secondary #4", "Pitch #5",
      "Secondary #5", "Pitch #6",
      "Secondary #6", "Pitch #7",
      "Command",
      "Control",
      "Fastball Velocity"
    ]
    : [
        "Hit",
        "Raw Power",
        "Game Power",
        "Bat to Ball",
        "Swing Decisions",
        "Speed",
        "Field",
        "Arm"
      ];

  return `
    <div class="compare-card">

      ${isRealValue(picture)
        ? `<img class="compare-player-photo" src="${picture}" alt="${name}" onerror="this.style.display='none';">`
        : ""
      }

      <h3>
        <a href="player.html?id=${encodeURIComponent(playerID)}">${name}</a>
      </h3>

      <div class="compare-two-col">
        <div>
          ${compareLine("Rank", `#${get(bio, ["Rank"])}`)}
          ${compareLine("OFP", get(bio, ["OFP"]))}
          ${compareLine("Risk", get(bio, ["Risk"]))}
          ${compareLine("Pos", get(bio, ["Position", "Pos"]))}
          ${compareLine("Level", get(bio, ["Level"]))}
          ${compareLine("Age", get(bio, ["Age"]))}
          ${compareLine("Height", get(bio, ["Height"]))}
          ${compareLine("Weight", get(bio, ["Weight"]))}
        </div>

        <div>
          <h4>Tool Grades</h4>
          ${toolKeys.map(key => compareLine(key, get(tools, [key]))).join("")}
        </div>
      </div>

      <h4 class="compare-stats-title">2026 Stats</h4>

    </div>
  `;
}

function compareLine(label, value) {
  if (!isRealValue(value)) return "";

  return `
    <div class="compare-line">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}
function setupMobileDropdown() {
  const dropdown = document.querySelector(".dropdown-nav");
  const button = document.querySelector(".dropdown-button");

  if (!dropdown || !button) return;

  button.addEventListener("click", e => {
    e.preventDefault();
    dropdown.classList.toggle("open");
  });

  document.addEventListener("click", e => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove("open");
    }
  });
}
