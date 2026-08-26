import fs from "node:fs";
import path from "node:path";

const PUB_ID =
  "2PACX-1vS7YJJLyptStf41slMLw1QW6g6gBW1rg6dlHdwFacsqlZth7lSnCKsJ5Sbtck0iw5y0ZAHDoDId9HsE";


/* =========================
   SHEETS TO EXPORT
========================= */

const SHEETS = {

  "Biography Info": {
    gid: "536791829",
    file: "biography.json"
  },

  "Archived Biography Info": {
    gid: "1669539724",
    file: "archived-biography.json"
  },

  "Pitcher Tools": {
    gid: "1738771068",
    file: "pitcher-tools.json"
  },

  "Hitter Tools": {
    gid: "146410825",
    file: "hitter-tools.json"
  },

  "Hitter Stats 2023": {
    gid: "341964968",
    file: "hitter-stats-2023.json"
  },

  "Hitter Stats 2024": {
    gid: "1018953464",
    file: "hitter-stats-2024.json"
  },

  "Hitter Stats 2025": {
    gid: "544979732",
    file: "hitter-stats-2025.json"
  },

  "Hitter Stats 2026": {
    gid: "1317907704",
    file: "hitter-stats-2026.json"
  },

  "Pitcher Stats 2023": {
    gid: "1576192112",
    file: "pitcher-stats-2023.json"
  },

  "Pitcher Stats 2024": {
    gid: "158387021",
    file: "pitcher-stats-2024.json"
  },

  "Pitcher Stats 2025": {
    gid: "1099458194",
    file: "pitcher-stats-2025.json"
  },

  "Pitcher Stats 2026": {
    gid: "1603996515",
    file: "pitcher-stats-2026.json"
  },

  "Videos": {
    gid: "1306695134",
    file: "videos.json"
  },

  "Draft History": {
    gid: "1343344959",
    file: "draft-history.json"
  },

  "International Signing History": {
    gid: "1283419308",
    file: "international-history.json"
  },

  "Rule 5 Eligibility": {
    gid: "2076057970",
    file: "rule5.json"
  },

  "MiLB Free Agency": {
    gid: "951187066",
    file: "free-agency.json"
  },

  "MiLB Depth Chart": {
    gid: "1115115429",
    file: "depth-chart.json"
  },

  "Transactions": {
    gid: "378792263",
    file: "transactions.json"
  }

};


/* =========================
   CSV PARSER
========================= */

function parseCSV(text) {

  const rows = [];

  let row = [];
  let cell = "";
  let inQuotes = false;


  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const char =
      text[i];

    const next =
      text[i + 1];


    if (
      char === '"' &&
      inQuotes &&
      next === '"'
    ) {

      cell += '"';

      i++;

    } else if (
      char === '"'
    ) {

      inQuotes =
        !inQuotes;

    } else if (
      char === "," &&
      !inQuotes
    ) {

      row.push(
        cell.trim()
      );

      cell = "";

    } else if (
      (
        char === "\n" ||
        char === "\r"
      ) &&
      !inQuotes
    ) {

      if (
        char === "\r" &&
        next === "\n"
      ) {
        i++;
      }


      row.push(
        cell.trim()
      );


      if (
        row.some(
          value =>
            value !== ""
        )
      ) {
        rows.push(row);
      }


      row = [];
      cell = "";

    } else {

      cell += char;
    }
  }


  if (
    cell ||
    row.length
  ) {

    row.push(
      cell.trim()
    );

    rows.push(row);
  }


  if (!rows.length) {
    return [];
  }


  const headers =
    rows
      .shift()
      .map(header =>
        header
          .replace(/^\uFEFF/, "")
          .trim()
      );


  return rows.map(row => {

    const object = {};


    headers.forEach(
      (header, index) => {

        object[header] =
          row[index] ?? "";

      }
    );


    return object;
  });
}


/* =========================
   GENERAL HELPERS
========================= */

function get(row, keys) {

  if (!row) {
    return "";
  }


  for (const key of keys) {

    if (
      row[key] !== undefined &&
      String(row[key]).trim() !== ""
    ) {
      return row[key];
    }
  }


  return "";
}


function cleanValue(value) {

  return String(
    value ?? ""
  ).trim();
}


function normalizeName(value) {

  return cleanValue(value)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();
}


function getPlayerID(row) {

  return cleanValue(
    get(
      row,
      [
        "Player-ID",
        "Player ID"
      ]
    )
  );
}


function getPlayerName(row) {

  return cleanValue(
    get(
      row,
      [
        "Player",
        "PlayerName",
        "Player Name",
        "Name"
      ]
    )
  );
}


function getMLBAMID(row) {

  return cleanValue(
    get(
      row,
      [
        "MLBAM ID",
        "MLBAM-ID",
        "MLB ID",
        "MiLB ID"
      ]
    )
  );
}
/* =========================
   LOAD GAMEDAY WHIFF DATA
========================= */

function loadGamedayWhiffData() {

  const filePath =
    path.join(
      "data",
      "gameday-whiff-rates.json"
    );


  if (
    !fs.existsSync(filePath)
  ) {

    console.warn(
      "No gameday-whiff-rates.json found. Continuing without Gameday Whiff%."
    );

    return {
      hitters: {},
      pitchers: {}
    };
  }


  try {

    const data =
      JSON.parse(
        fs.readFileSync(
          filePath,
          "utf8"
        )
      );


    console.log(
      `Loaded Gameday Whiff data: ${
        Object.keys(
          data.hitters || {}
        ).length
      } hitters, ${
        Object.keys(
          data.pitchers || {}
        ).length
      } pitchers`
    );


    return {
      hitters:
        data.hitters || {},

      pitchers:
        data.pitchers || {},

      season:
        data.season || "",

      generatedAt:
        data.generatedAt || ""
    };


  } catch (error) {

    console.warn(
      "Could not read gameday-whiff-rates.json:",
      error.message
    );


    return {
      hitters: {},
      pitchers: {}
    };
  }
}

/* =========================
   SAFE FILE NAME
========================= */

function safePlayerFileName(
  playerID
) {

  return cleanValue(
    playerID
  ).replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
}


/* =========================
   MATCH ROW TO PLAYER
========================= */

function rowMatchesPlayer(
  row,
  playerID,
  playerName
) {

  const rowID =
    getPlayerID(row);


  /*
    Player-ID is the preferred
    matching method.
  */

  if (
    rowID &&
    playerID &&
    rowID === playerID
  ) {
    return true;
  }


  /*
    Name fallback.

    This also handles accents
    and punctuation differences.
  */

  const rowName =
    normalizeName(
      getPlayerName(row)
    );


  const targetName =
    normalizeName(
      playerName
    );


  return Boolean(
    rowName &&
    targetName &&
    rowName === targetName
  );
}


/* =========================
   RESET PLAYER DIRECTORY
========================= */

function prepareDirectory(
  directory
) {

  /*
    Delete old generated files.

    This prevents files for players
    who have moved from active to
    archived from hanging around.
  */

  fs.rmSync(
    directory,
    {
      recursive: true,
      force: true
    }
  );


  fs.mkdirSync(
    directory,
    {
      recursive: true
    }
  );
}


/* =========================
   EXPORT ONE GOOGLE SHEET
========================= */

async function exportSheet(
  sheetName,
  config
) {

  const url =
    `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=${config.gid}&single=true&output=csv`;


  console.log(
    `Downloading ${sheetName}...`
  );


  const response =
    await fetch(url);


  if (!response.ok) {

    throw new Error(
      `${sheetName} failed: ${response.status}`
    );
  }


  const csv =
    await response.text();


  const rows =
    parseCSV(csv);


  const outputPath =
    path.join(
      "data",
      config.file
    );


  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      rows,
      null,
      2
    ),
    "utf8"
  );


  console.log(
    `${sheetName}: ${rows.length} rows`
  );


  return rows;
}


/* =========================
   FIND PLAYER ROW
========================= */

function findPlayerRow(
  rows,
  playerID,
  playerName
) {

  return (
    rows.find(row =>
      rowMatchesPlayer(
        row,
        playerID,
        playerName
      )
    ) ||
    null
  );
}


/* =========================
   FIND PLAYER ROWS
========================= */

function findPlayerRows(
  rows,
  playerID,
  playerName
) {

  return rows.filter(row =>
    rowMatchesPlayer(
      row,
      playerID,
      playerName
    )
  );
}


/* =========================
   TRANSACTION MATCHING
========================= */

function findPlayerTransactions(
  rows,
  bio
) {

  const playerID =
    getPlayerID(bio);


  const playerName =
    getPlayerName(bio);


  const mlbamID =
    getMLBAMID(bio);


  return rows.filter(row => {

    /*
      First try Backfield Brew
      Player-ID / player name.
    */

    if (
      rowMatchesPlayer(
        row,
        playerID,
        playerName
      )
    ) {
      return true;
    }


    /*
      Transactions can also use
      MLBAM ID.
    */

    if (!mlbamID) {
      return false;
    }


    const transactionMLBAM =
      cleanValue(
        get(
          row,
          [
            "MLBAM ID",
            "MLBAM-ID",
            "MLB ID"
          ]
        )
      );


    return Boolean(
      transactionMLBAM &&
      transactionMLBAM === mlbamID
    );
  });
}


/* =========================
   BUILD ONE PLAYER OBJECT
========================= */

function buildPlayerObject({
  bio,
  archived,
  datasets,
  generatedAt
}) {

  const playerID =
    getPlayerID(bio);


  const playerName =
    getPlayerName(bio);


  const playerType =
    cleanValue(
      get(
        bio,
        ["Player Type"]
      )
    ).toLowerCase();


  const isPitcher =
    playerType.includes(
      "pitch"
    );
/* =========================
   GAMEDAY WHIFF DATA
========================= */

const mlbamID =
  getMLBAMID(bio);


const gamedayData =
  datasets[
    "Gameday Whiffs"
  ] || {};


const whiffCollection =
  isPitcher
    ? gamedayData.pitchers || {}
    : gamedayData.hitters || {};


const gamedayWhiff =
  mlbamID
    ? whiffCollection[
        String(mlbamID)
      ] || null
    : null;

  /* =========================
     TOOLS
  ========================= */

  const toolsSheet =
    isPitcher
      ? "Pitcher Tools"
      : "Hitter Tools";


  const tools =
    findPlayerRow(
      datasets[
        toolsSheet
      ] || [],
      playerID,
      playerName
    );


  /* =========================
     STATS
  ========================= */

  const statPrefix =
    isPitcher
      ? "Pitcher Stats"
      : "Hitter Stats";


  const stats = {};


  for (
    const year of [
      "2023",
      "2024",
      "2025",
      "2026"
    ]
  ) {

    const sheetName =
      `${statPrefix} ${year}`;


    const statRow =
      findPlayerRow(
        datasets[
          sheetName
        ] || [],
        playerID,
        playerName
      );


    if (statRow) {

      /*
        Clone the row so we don't
        alter the organization-wide
        stats dataset in memory.
      */

      const playerStatRow = {
        ...statRow
      };


      /*
        Add automated Gameday Whiff%
        to the current season.
      */

      if (
        year === String(
          gamedayData.season ||
          new Date().getFullYear()
        ) &&
        gamedayWhiff &&
        Number.isFinite(
          Number(
            gamedayWhiff.whiffPct
          )
        )
      ) {

        playerStatRow["Whiff%"] =
          `${Number(
            gamedayWhiff.whiffPct
          ).toFixed(1)}%`;

      }


      stats[year] =
        playerStatRow;
    }
  }


  /* =========================
     VIDEOS
  ========================= */

  const videos =
    findPlayerRows(
      datasets[
        "Videos"
      ] || [],
      playerID,
      playerName
    );


  /* =========================
     TRANSACTIONS
  ========================= */

  const transactions =
    findPlayerTransactions(
      datasets[
        "Transactions"
      ] || [],
      bio
    );


  /* =========================
     FINAL PLAYER OBJECT
  ========================= */

  return {

    id:
      playerID,

    name:
      playerName,

    archived:
      archived,

    playerType:
      isPitcher
        ? "Pitcher"
        : "Hitter",

    generatedAt:
      generatedAt,

    bio:
      bio,

    tools:
      tools,

    stats:
      stats,

    gamedayWhiff:
      gamedayWhiff
        ? {
            mlbamID:
              mlbamID,

            swings:
              gamedayWhiff.swings ?? null,

            whiffs:
              gamedayWhiff.whiffs ?? null,

            contacts:
              gamedayWhiff.contacts ?? null,

            whiffPct:
              gamedayWhiff.whiffPct ?? null,

            contactPct:
              gamedayWhiff.contactPct ?? null,

            games:
              gamedayWhiff.games ?? null,

            levels:
              gamedayWhiff.levels || []
          }
        : null,

    videos:
      videos,

    transactions:
      transactions

  };
}


/* =========================
   BUILD PLAYER FILES
========================= */

function buildPlayerFiles({
  bioRows,
  archived,
  directory,
  datasets,
  generatedAt
}) {

  prepareDirectory(
    directory
  );


  const index = [];


  let written = 0;

  let skipped = 0;


  for (
    const bio of bioRows
  ) {

    const playerID =
      getPlayerID(bio);


    const playerName =
      getPlayerName(bio);


    /*
      Player-ID is required because
      the website URL is based on it.
    */

    if (
      !playerID ||
      !playerName
    ) {

      skipped++;

      continue;
    }


    const fileName =
      `${safePlayerFileName(
        playerID
      )}.json`;


    const playerObject =
      buildPlayerObject({
        bio,
        archived,
        datasets,
        generatedAt
      });


    fs.writeFileSync(
      path.join(
        directory,
        fileName
      ),
      JSON.stringify(
        playerObject,
        null,
        2
      ),
      "utf8"
    );


    /*
      Lightweight index.

      We may use this later for
      universal search or other
      navigation features.
    */

    index.push({

      id:
        playerID,

      name:
        playerName,

      file:
        fileName,

      archived:
        archived

    });


    written++;
  }


  /*
    Create an index of all generated
    players in this directory.
  */

  fs.writeFileSync(
    path.join(
      directory,
      "index.json"
    ),
    JSON.stringify(
      index,
      null,
      2
    ),
    "utf8"
  );


  console.log(
    `${
      archived
        ? "Archived"
        : "Active"
    } player files: ${written}`
  );


  if (skipped) {

    console.log(
      `${
        archived
          ? "Archived"
          : "Active"
      } rows skipped because Player-ID or Player name was missing: ${skipped}`
    );
  }
}


/* =========================
   MAIN
========================= */

async function main() {

  fs.mkdirSync(
    "data",
    {
      recursive: true
    }
  );


  /*
    Keep all downloaded datasets
    in memory.

    That means we download each
    Google Sheet only once and use
    those rows to build every player.
  */

  const datasets = {};


  for (
    const [
      sheetName,
      config
    ]
    of Object.entries(
      SHEETS
    )
  ) {

    datasets[
      sheetName
    ] =
      await exportSheet(
        sheetName,
        config
      );
  }
    /* =========================
       ADD GAMEDAY WHIFF DATA
    ========================= */

    datasets[
      "Gameday Whiffs"
    ] =
      loadGamedayWhiffData();

      const generatedAt =
        new Date()
          .toISOString();


  /* =========================
     ACTIVE PLAYERS
  ========================= */

  buildPlayerFiles({

    bioRows:
      datasets[
        "Biography Info"
      ] || [],

    archived:
      false,

    directory:
      path.join(
        "data",
        "players"
      ),

    datasets:
      datasets,

    generatedAt:
      generatedAt

  });


  /* =========================
     ARCHIVED PLAYERS
  ========================= */

  buildPlayerFiles({

    bioRows:
      datasets[
        "Archived Biography Info"
      ] || [],

    archived:
      true,

    directory:
      path.join(
        "data",
        "archived-players"
      ),

    datasets:
      datasets,

    generatedAt:
      generatedAt

  });


  /* =========================
     GLOBAL TIMESTAMP
  ========================= */

  fs.writeFileSync(
    path.join(
      "data",
      "updated.json"
    ),
    JSON.stringify(
      {
        updated:
          generatedAt
      },
      null,
      2
    ),
    "utf8"
  );


  console.log(
    "All sheet exports and player files complete."
  );
}


/* =========================
   RUN
========================= */

main()
  .catch(error => {

    console.error(
      error
    );

    process.exit(1);

  });
