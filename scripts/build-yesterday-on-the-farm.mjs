import fs from "node:fs";
import path from "node:path";

/* =========================
   SETTINGS
========================= */

const MLB_API =
  "https://statsapi.mlb.com/api/v1";

const BREWERS_PARENT_ORG_ID = 158;

const TOP_HITTERS = 5;
const TOP_PITCHERS = 3;


/*
  AAA, AA, High-A, Single-A and Rookie.

  sportId 16 covers Rookie leagues.
  We identify ACL / DSL from the
  affiliate/league name.
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
  },

  {
    id: 16,
    level: "ROK"
  }

];


/* =========================
   DATE
========================= */

/*
  We want "yesterday" in
  Central Time rather than UTC.
*/

function getChicagoDateParts(
  date = new Date()
) {

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
        date
      );


  const getPart =
    type =>
      parts.find(
        part =>
          part.type === type
      )?.value || "";


  return {

    year:
      Number(
        getPart(
          "year"
        )
      ),

    month:
      Number(
        getPart(
          "month"
        )
      ),

    day:
      Number(
        getPart(
          "day"
        )
      )

  };
}


function getYesterdayChicago() {

  const {
    year,
    month,
    day
  } =
    getChicagoDateParts();


  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        12,
        0,
        0
      )
    );


  date.setUTCDate(
    date.getUTCDate() - 1
  );


  return date
    .toISOString()
    .slice(
      0,
      10
    );
}


/*
  DATE environment variable lets
  us manually test any date:

  DATE=2026-08-30 node scripts/...
*/

const TARGET_DATE =
  process.env.DATE ||
  getYesterdayChicago();


const SEASON =
  Number(
    TARGET_DATE.slice(
      0,
      4
    )
  );


/* =========================
   REQUEST HELPER
========================= */

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


      if (
        !response.ok
      ) {

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


/* =========================
   PLAYER DATABASE
========================= */

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


  const players =
    new Map();


  for (
    const row of rows
  ) {

    const mlbamId =
      Number(
        row["MLBAM ID"] || 0
      );


    if (
      !mlbamId
    ) {

      continue;
    }


    players.set(
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

        playerType:
          String(
            row["Player Type"] ||
            ""
          ),

        rank:
          parseRank(
            row.Rank
          ),

        databaseLevel:
          String(
            row.Level ||
            ""
          )

      }
    );
  }


  return players;
}


function parseRank(
  value
) {

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
    Number(
      text
    );


  return rank > 0
    ? rank
    : null;
}


/* =========================
   RANK BONUS
========================= */

function rankBonus(
  rank
) {

  if (
    !rank
  ) {

    return 0;
  }


  if (
    rank <= 5
  ) {

    return 1.95;
  }


  if (
    rank <= 10
  ) {

    return 1.60;
  }


  if (
    rank <= 20
  ) {

    return 1.25;
  }


  if (
    rank <= 35
  ) {

    return 1.00;
  }


  if (
    rank <= 50
  ) {

    return 0.50;
  }


  return 0.25;
}


/* =========================
   AFFILIATES
========================= */

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
    teamName.includes(
      "dsl"
    ) ||
    leagueName.includes(
      "dominican"
    )
  ) {

    return "DSL";
  }


  if (
    teamName.includes(
      "acl"
    ) ||
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
        .filter(
          team => {

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
          }
        );


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
            sport.id

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


/* =========================
   SCHEDULE
========================= */

async function getGamesForAffiliate(
  affiliate
) {

  const url =

    `${MLB_API}/schedule` +

    `?sportId=${affiliate.sportId}` +

    `&teamId=${affiliate.teamId}` +

    `&date=${TARGET_DATE}` +

    `&gameType=R`;


  const data =
    await fetchJSON(
      url
    );


  const games = [];


  for (
    const date of
    data.dates || []
  ) {

    for (
      const game of
      date.games || []
    ) {

      const abstractState =
        String(
          game.status
            ?.abstractGameState ||
          ""
        )
          .toLowerCase();


      const detailedState =
        String(
          game.status
            ?.detailedState ||
          ""
        )
          .toLowerCase();


      const finalGame =

        abstractState ===
          "final" ||

        detailedState.includes(
          "final"
        ) ||

        detailedState.includes(
          "completed"
        );


      if (
        !finalGame
      ) {

        continue;
      }


      games.push(
        {

          gamePk:
            Number(
              game.gamePk
            ),

          affiliate

        }
      );
    }
  }


  return games;
}


/* =========================
   BOX SCORES
========================= */

async function getBoxscore(
  gamePk
) {

  return fetchJSON(

    `${MLB_API}/game/${gamePk}/boxscore`

  );
}


function findAffiliateSide(
  boxscore,
  affiliateTeamId
) {

  const homeId =
    Number(
      boxscore.teams
        ?.home
        ?.team
        ?.id ||
      0
    );


  const awayId =
    Number(
      boxscore.teams
        ?.away
        ?.team
        ?.id ||
      0
    );


  if (
    homeId === affiliateTeamId
  ) {

    return boxscore
      .teams
      .home;
  }


  if (
    awayId === affiliateTeamId
  ) {

    return boxscore
      .teams
      .away;
  }


  return null;
}


/* =========================
   NUMBER HELPERS
========================= */

function number(
  value
) {

  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function inningsToOuts(
  value
) {

  const text =
    String(
      value ?? "0"
    );


  const [
    wholeText,
    fractionText = "0"
  ] =
    text.split(
      "."
    );


  const whole =
    number(
      wholeText
    );


  const fraction =
    number(
      fractionText
    );


  return (

    whole * 3 +

    Math.min(
      2,
      Math.max(
        0,
        fraction
      )
    )

  );
}


function outsToInnings(
  outs
) {

  const whole =
    Math.floor(
      outs / 3
    );


  const remainder =
    outs % 3;


  return (
    `${whole}.${remainder}`
  );
}


/* =========================
   EMPTY DAILY LINES
========================= */

function emptyHitter(
  databasePlayer,
  affiliate
) {

  return {

    mlbamId:
      databasePlayer.mlbamId,

    playerId:
      databasePlayer.playerId,

    name:
      databasePlayer.name,

    rank:
      databasePlayer.rank,

    affiliate:
      affiliate.name,

    level:
      affiliate.level,

    games:
      0,

    atBats:
      0,

    runs:
      0,

    hits:
      0,

    doubles:
      0,

    triples:
      0,

    homeRuns:
      0,

    rbi:
      0,

    baseOnBalls:
      0,

    hitByPitch:
      0,

    strikeOuts:
      0,

    stolenBases:
      0,

    caughtStealing:
      0

  };
}


function emptyPitcher(
  databasePlayer,
  affiliate
) {

  return {

    mlbamId:
      databasePlayer.mlbamId,

    playerId:
      databasePlayer.playerId,

    name:
      databasePlayer.name,

    rank:
      databasePlayer.rank,

    affiliate:
      affiliate.name,

    level:
      affiliate.level,

    games:
      0,

    outs:
      0,

    hits:
      0,

    runs:
      0,

    earnedRuns:
      0,

    baseOnBalls:
      0,

    strikeOuts:
      0,

    homeRuns:
      0,

    hitByPitch:
      0,

    pitchesThrown:
      0,

    strikes:
      0

  };
}


/* =========================
   ADD STATS
========================= */

function addBatting(
  target,
  stats
) {

  target.games += 1;

  target.atBats +=
    number(
      stats.atBats
    );

  target.runs +=
    number(
      stats.runs
    );

  target.hits +=
    number(
      stats.hits
    );

  target.doubles +=
    number(
      stats.doubles
    );

  target.triples +=
    number(
      stats.triples
    );

  target.homeRuns +=
    number(
      stats.homeRuns
    );

  target.rbi +=
    number(
      stats.rbi
    );

  target.baseOnBalls +=
    number(
      stats.baseOnBalls
    );

  target.hitByPitch +=
    number(
      stats.hitByPitch
    );

  target.strikeOuts +=
    number(
      stats.strikeOuts
    );

  target.stolenBases +=
    number(
      stats.stolenBases
    );

  target.caughtStealing +=
    number(
      stats.caughtStealing
    );
}


function addPitching(
  target,
  stats
) {

  target.games += 1;


  target.outs +=
    inningsToOuts(
      stats.inningsPitched
    );


  target.hits +=
    number(
      stats.hits
    );


  target.runs +=
    number(
      stats.runs
    );


  target.earnedRuns +=
    number(
      stats.earnedRuns
    );


  target.baseOnBalls +=
    number(
      stats.baseOnBalls
    );


  target.strikeOuts +=
    number(
      stats.strikeOuts
    );


  target.homeRuns +=
    number(
      stats.homeRuns
    );


  target.hitByPitch +=
    number(
      stats.hitByPitch
    );


  target.pitchesThrown +=
    number(
      stats.numberOfPitches ??
      stats.pitchesThrown
    );


  target.strikes +=
    number(
      stats.strikes
    );
}


/* =========================
   DAILY PLAYER LINES
========================= */

async function buildDailyLines(
  games,
  database
) {

  const hitters =
    new Map();


  const pitchers =
    new Map();


  for (
    const game of games
  ) {

    const boxscore =
      await getBoxscore(
        game.gamePk
      );


    const side =
      findAffiliateSide(
        boxscore,
        game.affiliate.teamId
      );


    if (
      !side
    ) {

      console.warn(
        `Could not identify Brewers team in game ${game.gamePk}`
      );

      continue;
    }


    for (
      const [
        key,
        player
      ]
      of Object.entries(
        side.players ||
        {}
      )
    ) {

      const mlbamId =
        Number(

          player.person
            ?.id ||

          key.replace(
            /^ID/,
            ""
          ) ||

          0

        );


      const databasePlayer =
        database.get(
          mlbamId
        );


      /*
        Ignore players who are not
        in the Backfield Brew database.
      */

      if (
        !databasePlayer
      ) {

        continue;
      }


      const batting =
        player.stats
          ?.batting;


      if (
        batting &&
        number(
          batting.plateAppearances
        ) > 0
      ) {

        if (
          !hitters.has(
            mlbamId
          )
        ) {

          hitters.set(

            mlbamId,

            emptyHitter(
              databasePlayer,
              game.affiliate
            )

          );
        }


        addBatting(

          hitters.get(
            mlbamId
          ),

          batting

        );
      }


      const pitching =
        player.stats
          ?.pitching;


      if (
        pitching &&
        inningsToOuts(
          pitching.inningsPitched
        ) > 0
      ) {

        if (
          !pitchers.has(
            mlbamId
          )
        ) {

          pitchers.set(

            mlbamId,

            emptyPitcher(
              databasePlayer,
              game.affiliate
            )

          );
        }


        addPitching(

          pitchers.get(
            mlbamId
          ),

          pitching

        );
      }
    }


    await sleep(
      100
    );
  }


  return {

    hitters:
      [
        ...hitters.values()
      ],

    pitchers:
      [
        ...pitchers.values()
      ]

  };
}


/* =========================
   HITTER SCORING
========================= */

function scoreHitter(
  player
) {

  const singles =
    Math.max(

      0,

      player.hits -

      player.doubles -

      player.triples -

      player.homeRuns

    );


  /*
    PERFORMANCE SCORE

    Single       +1
    Double       +2
    Triple       +3
    Home Run     +4

    BB/HBP       +0.75
    Run          +0.50
    RBI          +0.50
    SB           +1.00

    Strikeout    -0.35
    CS           -0.75
  */

  const performanceScore =

    singles *
      1.00 +

    player.doubles *
      2.00 +

    player.triples *
      3.00 +

    player.homeRuns *
      4.00 +

    player.baseOnBalls *
      0.75 +

    player.hitByPitch *
      0.75 +

    player.runs *
      0.50 +

    player.rbi *
      0.50 +

    player.stolenBases *
      1.00 -

    player.strikeOuts *
      0.35 -

    player.caughtStealing *
      0.75;


  const adjustment =
    rankBonus(
      player.rank
    );


  const score =
    performanceScore +
    adjustment;


  return {

    ...player,

    singles,

    performanceScore:
      round2(
        performanceScore
      ),

    rankBonus:
      round2(
        adjustment
      ),

    score:
      round2(
        score
      ),

    line:
      hitterLine(
        player
      )

  };
}


/* =========================
   HITTER DISPLAY LINE
========================= */

function hitterLine(
  player
) {

  const parts = [

    `${player.hits}-for-${player.atBats}`

  ];


  if (
    player.homeRuns
  ) {

    parts.push(
      `${player.homeRuns} HR`
    );
  }


  if (
    player.triples
  ) {

    parts.push(
      `${player.triples} 3B`
    );
  }


  if (
    player.doubles
  ) {

    parts.push(
      `${player.doubles} 2B`
    );
  }


  if (
    player.rbi
  ) {

    parts.push(
      `${player.rbi} RBI`
    );
  }


  if (
    player.runs
  ) {

    parts.push(
      `${player.runs} R`
    );
  }


  if (
    player.baseOnBalls
  ) {

    parts.push(
      `${player.baseOnBalls} BB`
    );
  }


  if (
    player.hitByPitch
  ) {

    parts.push(
      `${player.hitByPitch} HBP`
    );
  }


  if (
    player.stolenBases
  ) {

    parts.push(
      `${player.stolenBases} SB`
    );
  }


  return parts.join(
    ", "
  );
}


/*
  A player cannot make the board
  solely because of rank bonus.

  They need at least one positive
  box-score event.
*/

function hitterHadPositiveDay(
  player
) {

  return (

    player.hits > 0 ||

    player.homeRuns > 0 ||

    player.rbi > 0 ||

    player.stolenBases > 0

  );
}


/* =========================
   PITCHER SCORING
========================= */

function scorePitcher(
  player
) {

  const innings =
    player.outs / 3;


  /*
    PITCHER SCORE

    +2.00 per inning
    +0.80 per strikeout

    -0.70 per hit
    -0.70 per walk
    -0.40 per HBP
    -2.00 per earned run
    -1.00 per HR

    NO ranking adjustment.
  */

  const performanceScore =

    innings *
      2.00 +

    player.strikeOuts *
      0.80 -

    player.hits *
      0.70 -

    player.baseOnBalls *
      0.70 -

    player.hitByPitch *
      0.40 -

    player.earnedRuns *
      2.00 -

    player.homeRuns *
      1.00;


  return {

    ...player,

    inningsPitched:
      outsToInnings(
        player.outs
      ),

    performanceScore:
      round2(
        performanceScore
      ),

    rankBonus:
      0,

    score:
      round2(
        performanceScore
      ),

    line:
      pitcherLine(
        player
      )

  };
}


/* =========================
   PITCHER DISPLAY LINE
========================= */

function pitcherLine(
  player
) {

  return [

    `${outsToInnings(
      player.outs
    )} IP`,

    `${player.hits} H`,

    `${player.earnedRuns} ER`,

    `${player.baseOnBalls} BB`,

    `${player.strikeOuts} K`

  ]
    .join(
      ", "
    );
}


/* =========================
   HELPERS
========================= */

function round2(
  value
) {

  return Math.round(

    (
      value +
      Number.EPSILON
    ) *

    100

  ) / 100;
}


/* =========================
   WRITE JSON
========================= */

function writeOutput(
  payload
) {

  const dataDir =
    path.join(
      process.cwd(),
      "data"
    );


  const archiveDir =
    path.join(
      dataDir,
      "yotf"
    );


  fs.mkdirSync(
    archiveDir,
    {
      recursive:
        true
    }
  );


  const latestFile =
    path.join(
      dataDir,
      "yesterday-on-the-farm.json"
    );


  const archiveFile =
    path.join(
      archiveDir,
      `${TARGET_DATE}.json`
    );


  const json =
    `${JSON.stringify(
      payload,
      null,
      2
    )}\n`;


  fs.writeFileSync(
    latestFile,
    json
  );


  fs.writeFileSync(
    archiveFile,
    json
  );


  console.log(
    `Wrote ${latestFile}`
  );


  console.log(
    `Wrote ${archiveFile}`
  );
}


/* =========================
   MAIN
========================= */

async function main() {

  console.log(
    `Building Yesterday on the Farm for ${TARGET_DATE}...`
  );


  const database =
    loadPlayerDatabase();


  console.log(
    `${database.size} players loaded from biography.json`
  );


  const affiliates =
    await getBrewersAffiliates();


  console.log(
    "\nAffiliates:"
  );


  for (
    const affiliate of affiliates
  ) {

    console.log(

      `${affiliate.level}: ` +
      `${affiliate.name}`

    );
  }


  /*
    gamePk is unique.

    Map protects us against
    duplicate games.
  */

  const gameMap =
    new Map();


  for (
    const affiliate of affiliates
  ) {

    try {

      const games =
        await getGamesForAffiliate(
          affiliate
        );


      for (
        const game of games
      ) {

        gameMap.set(
          game.gamePk,
          game
        );
      }

    } catch (error) {

      console.warn(

        `Schedule failed for ` +
        `${affiliate.name}: ` +
        `${error.message}`

      );
    }
  }


  const games =
    [
      ...gameMap.values()
    ];


  console.log(
    `\nCompleted Brewers MiLB games found: ${games.length}`
  );


  const daily =
    await buildDailyLines(
      games,
      database
    );


  /*
    Hitters:

    First sort by FINAL score.

    If tied:
      1. Better raw performance
      2. Better prospect rank
  */

  const allHitters =

    daily.hitters

      .map(
        scoreHitter
      )

      .filter(
        hitterHadPositiveDay
      )

      .sort(
        (
          a,
          b
        ) =>

          b.score -
            a.score ||

          b.performanceScore -
            a.performanceScore ||

          (
            a.rank ??
            9999
          ) -

          (
            b.rank ??
            9999
          )

      );


  /*
    Pitchers:

    Ranking is completely ignored.
  */

  const allPitchers =

    daily.pitchers

      .map(
        scorePitcher
      )

      .sort(
        (
          a,
          b
        ) =>

          b.score -
            a.score ||

          b.outs -
            a.outs ||

          b.strikeOuts -
            a.strikeOuts

      );


  const payload = {

    date:
      TARGET_DATE,

    generatedAt:
      new Date()
        .toISOString(),

    scoringVersion:
      1,


    hitterRankBonuses: {

      "1-5":
        1.95,

      "6-10":
        1.60,

      "11-20":
        1.25,

      "21-35":
        1.00,

      "36-50":
        0.50,

      "51+":
        0.25,

      unranked:
        0

    },


    affiliates,

    completedGames:
      games.length,


    hitters:

      allHitters.slice(
        0,
        TOP_HITTERS
      ),


    pitchers:

      allPitchers.slice(
        0,
        TOP_PITCHERS
      ),


    /*
      Keeping the full lists for now
      is intentional.

      This lets us inspect the scoring
      and adjust it before putting the
      feature on the site.
    */

    allHitters,

    allPitchers

  };


  writeOutput(
    payload
  );


  console.log(
    "\nTOP HITTERS"
  );


  for (
    const [
      index,
      player
    ]
    of payload.hitters.entries()
  ) {

    console.log(

      `${index + 1}. ` +
      `${player.name} — ` +
      `${player.line} | ` +
      `performance ${player.performanceScore} ` +
      `+ rank ${player.rankBonus} ` +
      `= ${player.score}`

    );
  }


  console.log(
    "\nTOP PITCHERS"
  );


  for (
    const [
      index,
      player
    ]
    of payload.pitchers.entries()
  ) {

    console.log(

      `${index + 1}. ` +
      `${player.name} — ` +
      `${player.line} | ` +
      `score ${player.score}`

    );
  }
}


/* =========================
   RUN
========================= */

main()
  .catch(
    error => {

      console.error(
        error
      );

      process.exitCode =
        1;
    }
  );
