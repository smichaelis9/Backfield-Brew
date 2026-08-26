import fs from "node:fs";
import path from "node:path";


/* =========================
   SETTINGS
========================= */

const SEASON =
  Number(
    process.env.SEASON ||
    new Date().getFullYear()
  );


const MLB_API =
  "https://statsapi.mlb.com/api/v1";


/*
  Milwaukee Brewers MLB team ID.
  Used to discover current affiliates.
*/
const BREWERS_PARENT_ORG_ID = 158;


/*
  Full-season MiLB levels only.
*/
const SPORTS = [
  {
    id: 11,
    level: "AAA"
  },
  {
    id: 12,
    level: "AA"
  },
  {
    id: 13,
    level: "A+"
  },
  {
    id: 14,
    level: "A"
  }
];


/*
  Regular season only.
*/
const GAME_TYPES = new Set([
  "R"
]);


/* =========================
   REQUEST HELPER
========================= */

async function fetchJSON(
  url,
  retries = 3
) {

  for (
    let attempt = 1;
    attempt <= retries;
    attempt++
  ) {

    try {

      const response =
        await fetch(
          url,
          {
            headers: {
              "User-Agent":
                "Backfield-Brew/1.0"
            }
          }
        );


      if (!response.ok) {

        throw new Error(
          `${response.status} ${response.statusText}`
        );
      }


      return await response.json();


    } catch (error) {

      if (
        attempt === retries
      ) {
        throw error;
      }


      await sleep(
        1000 * attempt
      );
    }
  }
}


function sleep(ms) {

  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}


/* =========================
   DISCOVER BREWERS AFFILIATES
========================= */

async function getBrewersAffiliates() {

  const affiliates = [];


  for (
    const sport of SPORTS
  ) {

    const url =
      `${MLB_API}/teams` +
      `?sportId=${sport.id}` +
      `&season=${SEASON}`;


    console.log(
      `Finding ${sport.level} affiliate...`
    );


    const data =
      await fetchJSON(url);


    const teams =
      data.teams || [];


    const team =
      teams.find(team => {

        const parentOrgId =
          Number(
            team.parentOrgId || 0
          );


        const parentName =
          String(
            team.parentOrgName || ""
          ).toLowerCase();


        return (
          parentOrgId ===
            BREWERS_PARENT_ORG_ID ||
          parentName.includes(
            "milwaukee brewers"
          )
        );
      });


    if (!team) {

      console.warn(
        `No Brewers ${sport.level} affiliate found.`
      );

      continue;
    }


    affiliates.push({
      teamId:
        team.id,

      name:
        team.name,

      level:
        sport.level,

      sportId:
        sport.id
    });


    console.log(
      `${sport.level}: ${team.name} (${team.id})`
    );
  }


  return affiliates;
}


/* =========================
   GET TEAM SCHEDULE
========================= */

async function getTeamGames(
  affiliate
) {

  const url =
    `${MLB_API}/schedule` +
    `?sportId=${affiliate.sportId}` +
    `&teamId=${affiliate.teamId}` +
    `&season=${SEASON}` +
    `&gameType=R`;


  console.log(
    `Loading schedule for ${affiliate.name}...`
  );


  const data =
    await fetchJSON(url);


  const games = [];


  for (
    const date of
    data.dates || []
  ) {

    for (
      const game of
      date.games || []
    ) {

      if (
        !GAME_TYPES.has(
          game.gameType
        )
      ) {
        continue;
      }


      const state =
        String(
          game.status
            ?.abstractGameState ||
          ""
        );


      /*
        Ignore scheduled / future
        games because there is no
        useful PBP yet.
      */

      if (
        ![
          "Final",
          "Live"
        ].includes(state)
      ) {
        continue;
      }


      games.push({
        gamePk:
          game.gamePk,

        date:
          game.gameDate,

        level:
          affiliate.level,

        affiliate:
          affiliate.name
      });
    }
  }


  return games;
}


/* =========================
   PITCH CLASSIFICATION
========================= */

function classifyPitch(
  event
) {

  if (
    !event ||
    event.isPitch !== true
  ) {
    return null;
  }


  const description =
    String(
      event.details
        ?.description ||
      ""
    )
      .trim()
      .toLowerCase();


  const code =
    String(
      event.details
        ?.code ||
      ""
    )
      .trim()
      .toUpperCase();


  const isInPlay =
    event.details
      ?.isInPlay === true;


  /*
    WHIFFS

    Covers:
    - Swinging Strike
    - Swinging Strike (Blocked)
    - Swinging Pitchout
    - Missed Bunt
  */

  const isWhiff =
    description.includes(
      "swinging strike"
    ) ||
    description.includes(
      "swinging pitchout"
    ) ||
    description.includes(
      "missed bunt"
    ) ||
    [
      "S",
      "W",
      "M"
    ].includes(code);


  /*
    CONTACT / SWING EVENTS

    A swing is:
    - whiff
    - foul
    - foul tip
    - foul bunt
    - ball in play
  */

  const isFoul =
    description.includes(
      "foul"
    ) ||
    [
      "F",
      "L",
      "O",
      "T"
    ].includes(code);


  const isSwing =
    isWhiff ||
    isFoul ||
    isInPlay ||
    [
      "X",
      "Y"
    ].includes(code);


  return {
    isSwing,
    isWhiff,
    description,
    code
  };
}


/* =========================
   EMPTY PLAYER RECORD
========================= */

function createRecord(
  playerId,
  name
) {

  return {
    playerId:
      Number(playerId),

    name:
      name || "",

    pitches:
      0,

    swings:
      0,

    whiffs:
      0,

    contacts:
      0,

    whiffPct:
      null,

    contactPct:
      null,

    games:
      new Set(),

    levels:
      new Set()
  };
}


/* =========================
   UPDATE PLAYER RECORD
========================= */

function updateRecord(
  map,
  playerId,
  playerName,
  classification,
  game
) {

  if (!playerId) {
    return;
  }


  const key =
    String(playerId);


  if (!map.has(key)) {

    map.set(
      key,
      createRecord(
        playerId,
        playerName
      )
    );
  }


  const record =
    map.get(key);


  record.pitches++;


  if (
    classification.isSwing
  ) {

    record.swings++;


    if (
      classification.isWhiff
    ) {

      record.whiffs++;

    } else {

      record.contacts++;
    }
  }


  record.games.add(
    game.gamePk
  );


  record.levels.add(
    game.level
  );
}


/* =========================
   PROCESS ONE GAME
========================= */

async function processGame(
  game,
  hitters,
  pitchers
) {

  const url =
    `${MLB_API}/game/` +
    `${game.gamePk}/playByPlay`;


  const data =
    await fetchJSON(url);


  const plays =
    data.allPlays || [];


  for (
    const play of plays
  ) {

    const batterId =
      play.matchup
        ?.batter
        ?.id;


    const batterName =
      play.matchup
        ?.batter
        ?.fullName;


    const pitcherId =
      play.matchup
        ?.pitcher
        ?.id;


    const pitcherName =
      play.matchup
        ?.pitcher
        ?.fullName;


    for (
      const event of
      play.playEvents || []
    ) {

      const classification =
        classifyPitch(event);


      if (!classification) {
        continue;
      }


      updateRecord(
        hitters,
        batterId,
        batterName,
        classification,
        game
      );


      updateRecord(
        pitchers,
        pitcherId,
        pitcherName,
        classification,
        game
      );
    }
  }
}


/* =========================
   FINALIZE RECORDS
========================= */

function finalizeMap(
  map
) {

  const output = {};


  for (
    const [
      id,
      record
    ]
    of map.entries()
  ) {

    const whiffPct =
      record.swings > 0
        ? (
            record.whiffs /
            record.swings
          ) * 100
        : null;


    const contactPct =
      record.swings > 0
        ? (
            record.contacts /
            record.swings
          ) * 100
        : null;


    output[id] = {

      playerId:
        record.playerId,

      name:
        record.name,

      pitches:
        record.pitches,

      swings:
        record.swings,

      whiffs:
        record.whiffs,

      contacts:
        record.contacts,

      whiffPct:
        whiffPct === null
          ? null
          : Number(
              whiffPct.toFixed(1)
            ),

      contactPct:
        contactPct === null
          ? null
          : Number(
              contactPct.toFixed(1)
            ),

      games:
        record.games.size,

      levels:
        [
          ...record.levels
        ].sort()

    };
  }


  return output;
}


/* =========================
   RUN IN SMALL BATCHES
========================= */

async function runPool(
  items,
  concurrency,
  worker
) {

  let index = 0;


  async function runWorker() {

    while (true) {

      const current =
        index++;


      if (
        current >= items.length
      ) {
        break;
      }


      await worker(
        items[current],
        current
      );


      /*
        Be polite to the API.
      */

      await sleep(100);
    }
  }


  const workers =
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            items.length
          )
      },
      () =>
        runWorker()
    );


  await Promise.all(
    workers
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


  const affiliates =
    await getBrewersAffiliates();


  if (!affiliates.length) {

    throw new Error(
      "No Brewers affiliates were found."
    );
  }


  const allGames = [];


  for (
    const affiliate of
    affiliates
  ) {

    const games =
      await getTeamGames(
        affiliate
      );


    allGames.push(
      ...games
    );


    console.log(
      `${affiliate.name}: ${games.length} games`
    );
  }


  /*
    Remove duplicates just in case.
  */

  const uniqueGameMap =
    new Map();


  allGames.forEach(game => {

    uniqueGameMap.set(
      game.gamePk,
      game
    );
  });


  const games =
    [
      ...uniqueGameMap.values()
    ];


  console.log(
    `Processing ${games.length} unique games...`
  );


  const hitters =
    new Map();


  const pitchers =
    new Map();


  let completed = 0;


  await runPool(
    games,
    5,
    async game => {

      try {

        await processGame(
          game,
          hitters,
          pitchers
        );


        completed++;


        if (
          completed % 25 === 0 ||
          completed === games.length
        ) {

          console.log(
            `${completed}/${games.length} games processed`
          );
        }


      } catch (error) {

        console.warn(
          `Game ${game.gamePk} failed:`,
          error.message
        );
      }
    }
  );


  const output = {

    season:
      SEASON,

    generatedAt:
      new Date()
        .toISOString(),

    source:
      "MLB Stats API Gameday play-by-play",

    definition: {
      whiffPct:
        "Whiffs divided by swings",
      scope:
        "Brewers AAA, AA, High-A and Single-A regular-season games with Gameday pitch-by-pitch"
    },

    affiliates,

    gamesProcessed:
      completed,

    hitters:
      finalizeMap(
        hitters
      ),

    pitchers:
      finalizeMap(
        pitchers
      )

  };


  fs.writeFileSync(
    path.join(
      "data",
      "gameday-whiff-rates.json"
    ),
    JSON.stringify(
      output,
      null,
      2
    ),
    "utf8"
  );


  console.log(
    `Hitters: ${Object.keys(output.hitters).length}`
  );


  console.log(
    `Pitchers: ${Object.keys(output.pitchers).length}`
  );


  console.log(
    "Whiff-rate update complete."
  );
}


main()
  .catch(error => {

    console.error(
      error
    );

    process.exit(1);

  });
