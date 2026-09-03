import fs from "node:fs";
import path from "node:path";


/* =========================================================
   SETTINGS
========================================================= */

const MLB_API =
  "https://statsapi.mlb.com/api/v1";

const BREWERS_PARENT_ORG_ID = 158;


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
  },

  {
    id: 16,
    level: "ROK"
  }

];


/* =========================================================
   DATE
========================================================= */

function getChicagoDate() {

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "America/Chicago",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit"
      }
    )
      .formatToParts(
        new Date()
      );


  const getPart =
    type =>
      parts.find(
        part =>
          part.type === type
      )?.value || "";


  return (
    `${getPart("year")}-` +
    `${getPart("month")}-` +
    `${getPart("day")}`
  );
}


/*
  Allows manual historical /
  future testing:

  DATE=2026-09-03 node scripts/build-today-on-the-farm.mjs
*/

const TARGET_DATE =
  process.env.DATE ||
  getChicagoDate();


const SEASON =
  Number(
    TARGET_DATE.slice(
      0,
      4
    )
  );


/* =========================================================
   REQUEST HELPER
========================================================= */

function sleep(ms) {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}


async function fetchJSON(
  url,
  retries = 4
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


/* =========================================================
   PLAYER DATABASE
========================================================= */

function loadPlayerDatabase() {

  const file =
    path.join(
      process.cwd(),
      "data",
      "biography.json"
    );


  const rows =
    JSON.parse(
      fs.readFileSync(
        file,
        "utf8"
      )
    );


  const byMlbam =
    new Map();


  for (
    const row of rows
  ) {

    const mlbamId =
      Number(
        row["MLBAM ID"] ||
        0
      );


    if (!mlbamId) {
      continue;
    }


    byMlbam.set(
      mlbamId,
      {

        mlbamId,

        playerId:
          String(
            row["Player-ID"] ||
            ""
          ),

        name:
          String(
            row.Player ||
            ""
          ),

        rank:
          parseRank(
            row.Rank
          ),

        picture:
          String(
            row.Picture ||
            ""
          ),

        databaseLevel:
          String(
            row.Level ||
            ""
          )

      }
    );
  }


  return byMlbam;
}


function parseRank(value) {

  const text =
    String(
      value ?? ""
    )
      .trim();


  if (
    !/^\d+$/.test(
      text
    )
  ) {

    return null;
  }


  const rank =
    Number(text);


  return rank > 0
    ? rank
    : null;
}


/* =========================================================
   AFFILIATES
========================================================= */

function getRookieLevel(
  team
) {

  const teamName =
    String(
      team.name ||
      ""
    )
      .toLowerCase();


  const leagueName =
    String(
      team.league?.name ||
      ""
    )
      .toLowerCase();


  if (
    teamName.includes("dsl") ||
    leagueName.includes(
      "dominican"
    )
  ) {

    return "DSL";
  }


  if (
    teamName.includes("acl") ||
    leagueName.includes(
      "arizona"
    )
  ) {

    return "ACL";
  }


  return "ROK";
}


async function getBrewersAffiliates() {

  const affiliates = [];


  for (
    const sport of SPORTS
  ) {

    const url =

      `${MLB_API}/teams` +

      `?sportId=${sport.id}` +

      `&season=${SEASON}` +

      `&hydrate=league`;


    console.log(
      `Finding Brewers affiliates for sportId ${sport.id}...`
    );


    const data =
      await fetchJSON(
        url
      );


    const matches =
      (
        data.teams ||
        []
      )
        .filter(team => {

          const parentOrgId =
            Number(
              team.parentOrgId ||
              0
            );


          const parentName =
            String(
              team.parentOrgName ||
              ""
            )
              .toLowerCase();


          return (

            parentOrgId ===
              BREWERS_PARENT_ORG_ID ||

            parentName.includes(
              "milwaukee brewers"
            )

          );
        });


    for (
      const team of matches
    ) {

      const level =
        sport.id === 16
          ? getRookieLevel(
              team
            )
          : sport.level;


      affiliates.push(
        {

          teamId:
            Number(
              team.id
            ),

          name:
            String(
              team.name ||
              ""
            ),

          level,

          sportId:
            sport.id,

          leagueId:
            Number(
              team.league?.id ||
              0
            ),

          leagueName:
            String(
              team.league?.name ||
              ""
            )

        }
      );


      console.log(
        `${level}: ${team.name} (${team.id})`
      );
    }
  }


  /*
    Protect against duplicate
    team IDs.
  */

  const unique =
    new Map();


  for (
    const affiliate of affiliates
  ) {

    unique.set(
      affiliate.teamId,
      affiliate
    );
  }


  return [
    ...unique.values()
  ];
}


/* =========================================================
   GAME STATUS
========================================================= */

function normalizeGameStatus(
  game
) {

  const status =
    game.status || {};


  const abstract =
    String(
      status.abstractGameState ||
      ""
    );


  const detailed =
    String(
      status.detailedState ||
      ""
    );


  const lower =
    detailed.toLowerCase();


  if (
    lower.includes(
      "postponed"
    )
  ) {

    return {
      key: "postponed",
      label: detailed || "Postponed"
    };
  }


  if (
    lower.includes(
      "cancel"
    )
  ) {

    return {
      key: "cancelled",
      label: detailed || "Cancelled"
    };
  }


  if (
    lower.includes(
      "delay"
    )
  ) {

    return {
      key: "delayed",
      label: detailed || "Delayed"
    };
  }


  if (
    abstract === "Final"
  ) {

    return {
      key: "final",
      label: detailed || "Final"
    };
  }


  if (
    abstract === "Live"
  ) {

    return {
      key: "live",
      label: detailed || "In Progress"
    };
  }


  return {
    key: "scheduled",
    label: detailed || "Scheduled"
  };
}


/* =========================================================
   PROBABLE PITCHER
========================================================= */

function getProbablePitcher(
  game,
  affiliateSide,
  players
) {

  const side =
    game.teams?.[
      affiliateSide
    ] || {};


  const probable =
    side.probablePitcher;


  if (
    !probable?.id
  ) {

    return null;
  }


  const mlbamId =
    Number(
      probable.id
    );


  const databasePlayer =
    players.get(
      mlbamId
    );


  return {

    mlbamId,

    name:
      String(
        probable.fullName ||
        databasePlayer?.name ||
        ""
      ),

    inDatabase:
      Boolean(
        databasePlayer
      ),

    playerId:
      databasePlayer?.playerId ||
      "",

    rank:
      databasePlayer?.rank ??
      null,

    picture:
      databasePlayer?.picture ||
      "",

    databaseLevel:
      databasePlayer?.databaseLevel ||
      ""

  };
}


/* =========================================================
   SCORE / INNING
========================================================= */

function getScore(
  game
) {

  const away =
    game.teams?.away?.score;

  const home =
    game.teams?.home?.score;


  if (
    !Number.isFinite(
      Number(away)
    ) ||
    !Number.isFinite(
      Number(home)
    )
  ) {

    return null;
  }


  return {

    away:
      Number(away),

    home:
      Number(home)

  };
}


function getInningInfo(
  game
) {

  const linescore =
    game.linescore ||
    {};


  const inning =
    Number(
      linescore.currentInning ||
      0
    );


  const state =
    String(
      linescore.inningState ||
      ""
    );


  const ordinal =
    String(
      linescore.currentInningOrdinal ||
      ""
    );


  if (!inning) {

    return null;
  }


  return {

    inning,

    state,

    ordinal

  };
}


/* =========================================================
   GET GAMES
========================================================= */

async function getAffiliateGames(
  affiliates,
  players
) {

  const games = [];


  for (
    const affiliate of affiliates
  ) {

    const url =

      `${MLB_API}/schedule` +

      `?teamId=${affiliate.teamId}` +

      `&date=${TARGET_DATE}` +

      `&sportId=${affiliate.sportId}` +

      `&hydrate=team,linescore,probablePitcher`;


    console.log(
      `Checking ${affiliate.name}...`
    );


    const data =
      await fetchJSON(
        url
      );


    const scheduleGames =
      data.dates?.flatMap(
        date =>
          date.games || []
      ) || [];


    for (
      const game of scheduleGames
    ) {

      const awayId =
        Number(
          game.teams?.away?.team?.id ||
          0
        );


      const homeId =
        Number(
          game.teams?.home?.team?.id ||
          0
        );


      let affiliateSide = null;


      if (
        awayId ===
        affiliate.teamId
      ) {

        affiliateSide = "away";

      } else if (
        homeId ===
        affiliate.teamId
      ) {

        affiliateSide = "home";
      }


      if (!affiliateSide) {
        continue;
      }


      const opponentSide =
        affiliateSide === "away"
          ? "home"
          : "away";


      const opponent =
        game.teams?.[
          opponentSide
        ]?.team || {};


      const status =
        normalizeGameStatus(
          game
        );


      const probablePitcher =
        getProbablePitcher(
          game,
          affiliateSide,
          players
        );


      games.push(
        {

          /*
            Include affiliate ID in
            the unique key so a
            Brewers-vs-Brewers DSL
            game can appear for both
            affiliates.
          */
          key:
            `${game.gamePk}:${affiliate.teamId}`,

          gamePk:
            Number(
              game.gamePk
            ),

          date:
            TARGET_DATE,

          gameDate:
            String(
              game.gameDate ||
              ""
            ),

          affiliate:
            affiliate.name,

          affiliateTeamId:
            affiliate.teamId,

          level:
            affiliate.level,

          leagueId:
            affiliate.leagueId,

          leagueName:
            affiliate.leagueName,

          homeAway:
            affiliateSide,

          opponent:
            String(
              opponent.name ||
              ""
            ),

          opponentTeamId:
            Number(
              opponent.id ||
              0
            ),

          venue:
            String(
              game.venue?.name ||
              ""
            ),

          status,

          score:
            getScore(
              game
            ),

          inning:
            getInningInfo(
              game
            ),

          probablePitcher,

          doubleHeader:
            String(
              game.doubleHeader ||
              "N"
            ),

          gameNumber:
            Number(
              game.gameNumber ||
              1
            )

        }
      );
    }
  }


  /*
    Deduplicate only exact
    affiliate/game combinations.
  */

  const unique =
    new Map();


  for (
    const game of games
  ) {

    unique.set(
      game.key,
      game
    );
  }


  return [
    ...unique.values()
  ]
    .sort(
      (a, b) => {

        const aTime =
          Date.parse(
            a.gameDate
          );

        const bTime =
          Date.parse(
            b.gameDate
          );


        if (
          Number.isFinite(aTime) &&
          Number.isFinite(bTime)
        ) {

          return (
            aTime -
            bTime
          );
        }


        return (
          a.affiliate.localeCompare(
            b.affiliate
          )
        );
      }
    );
}


/* =========================================================
   MAIN
========================================================= */

async function main() {

  console.log(
    `Building Today on the Farm for ${TARGET_DATE}`
  );


  const players =
    loadPlayerDatabase();


  console.log(
    `Loaded ${players.size} players with MLBAM IDs.`
  );


  const affiliates =
    await getBrewersAffiliates();


  console.log(
    `Found ${affiliates.length} Brewers affiliates.`
  );


  const games =
    await getAffiliateGames(
      affiliates,
      players
    );


  console.log(
    `Found ${games.length} affiliate game entries.`
  );


  const output = {

    date:
      TARGET_DATE,

    generatedAt:
      new Date()
        .toISOString(),

    affiliates,

    gameCount:
      games.length,

    games

  };


  const outputFile =
    path.join(
      process.cwd(),
      "data",
      "today-on-the-farm.json"
    );


  fs.writeFileSync(
    outputFile,
    JSON.stringify(
      output,
      null,
      2
    ) + "\n"
  );


  console.log(
    `Wrote ${outputFile}`
  );
}


main()
  .catch(error => {

    console.error(
      error
    );

    process.exit(1);

  });
