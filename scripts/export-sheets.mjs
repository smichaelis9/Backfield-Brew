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
      (char === "\n" ||
       char === "\r") &&
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
   EXPORT ONE SHEET
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


  for (
    const [sheetName, config]
    of Object.entries(SHEETS)
  ) {

    await exportSheet(
      sheetName,
      config
    );
  }


  /* Timestamp file */

  fs.writeFileSync(
    path.join(
      "data",
      "updated.json"
    ),
    JSON.stringify(
      {
        updated:
          new Date().toISOString()
      },
      null,
      2
    )
  );


  console.log(
    "All sheet exports complete."
  );
}


main()
  .catch(error => {

    console.error(error);

    process.exit(1);
  });
