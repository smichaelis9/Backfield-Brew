import fs from "node:fs";
import path from "node:path";

const MLB_API =
  "https://statsapi.mlb.com/api/v1";

const BREWERS_PARENT_ORG_ID = 158;


/* =========================================================
   SPORTS / LEVELS
========================================================= */

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
   DATE / SEASON
========================================================= */

function getChicagoDate() {

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
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
   FETCH
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


      console.warn(
        `Request failed. Retry ${attempt}/${retries}...`
      );


      await sleep(
        1000 * attempt
      );
    }
  }
}


/* =========================================================
   ROOKIE LEVEL
========================================================= */

function getRookieLevel(team) {

  const teamName =
    String(
      team.name || ""
    )
      .toLowerCase();


  const leagueName =
    String(
      team.league?.name || ""
    )
      .toLowerCase();


  if (
    teamName.includes("dsl") ||
    leagueName.includes("dominican")
  ) {
    return "DSL";
  }


  if (
    teamName.includes("acl") ||
    leagueName.includes("arizona")
  ) {
    return "ACL";
  }


  return "ROK";
}


/* =========================================================
   FIND BREWERS AFFILIATES
========================================================= */

async function getBrewersAffiliates() {

  const affiliates = [];


  for (
    const sport of SPORTS
  ) {

    const url =
      `${MLB_API}/teams` +
      `?sportId=${sport.id}` +
      `&season=${SEASON}` +
      `&hydrate=league,division`;


    console.log(
      `Finding Brewers affiliates for sportId ${sport.id}...`
    );


    const data =
      await fetchJSON(url);


    const matches =
      (data.teams || [])
        .filter(team => {

          const parentOrgId =
            Number(
              team.parentOrgId || 0
            );


          const parentName =
            String(
              team.parentOrgName || ""
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
          ? getRookieLevel(team)
          : sport.level;


      affiliates.push({
        teamId:
          Number(team.id),

        name:
          String(
            team.name || ""
          ),

        level,

        sportId:
          sport.id,

        leagueId:
          Number(
            team.league?.id || 0
          ),

        leagueName:
          String(
            team.league?.name || ""
          ),

        divisionId:
          Number(
            team.division?.id || 0
          ),

        divisionName:
          String(
            team.division?.name || ""
          )
      });


      console.log(
        `${level}: ${team.name}`
      );
    }
  }


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
   GET STANDINGS
========================================================= */

async function getLeagueStandings(
  affiliate
) {

  if (!affiliate.leagueId) {

    console.warn(
      `No league ID for ${affiliate.name}`
    );

    return null;
  }


  const url =
    `${MLB_API}/standings` +
    `?leagueId=${affiliate.leagueId}` +
    `&season=${SEASON}` +
    `&standingsTypes=regularSeason` +
    `&hydrate=team`;


  console.log(
    `Getting standings: ${affiliate.leagueName}`
  );


  const data =
    await fetchJSON(url);


  const records =
    Array.isArray(data.records)
      ? data.records
      : [];


  if (!records.length) {

    return null;
  }


  /*
   * Prefer the division containing
   * the Brewers affiliate.
   *
   * If there are no divisions,
   * use the first league record.
   */

  let record =
    records.find(item => {

      const divisionId =
        Number(
          item.division?.id || 0
        );


      return (
        affiliate.divisionId &&
        divisionId ===
          affiliate.divisionId
      );
    });


  if (!record) {

    record =
      records.find(item => {

        return (
          item.teamRecords || []
        )
          .some(teamRecord => {

            return (
              Number(
                teamRecord.team?.id || 0
              ) ===
              affiliate.teamId
            );
          });
      });
  }


  if (!record) {

    record =
      records[0];
  }


  const teams =
    (record.teamRecords || [])
      .map(teamRecord => {

        return {

          teamId:
            Number(
              teamRecord.team?.id || 0
            ),

          team:
            String(
              teamRecord.team?.name || ""
            ),

          wins:
            Number(
              teamRecord.wins || 0
            ),

          losses:
            Number(
              teamRecord.losses || 0
            ),

          pct:
            String(
              teamRecord.winningPercentage ||
              ""
            ),

          gamesBack:
            String(
              teamRecord.gamesBack ??
              ""
            ),

          divisionRank:
            String(
              teamRecord.divisionRank ||
              ""
            ),

          leagueRank:
            String(
              teamRecord.leagueRank ||
              ""
            ),

          wildCardRank:
            String(
              teamRecord.wildCardRank ||
              ""
            ),

          streak:
            String(
              teamRecord.streak?.streakCode ||
              ""
            ),

          isBrewersAffiliate:
            Number(
              teamRecord.team?.id || 0
            ) ===
              affiliate.teamId
        };
      });


  return {

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

    divisionId:
      Number(
        record.division?.id ||
        affiliate.divisionId ||
        0
      ),

    divisionName:
      String(
        record.division?.name ||
        affiliate.divisionName ||
        ""
      ),

    standingsType:
      String(
        record.standingsType ||
        "regularSeason"
      ),

    teams
  };
}


/* =========================================================
   MAIN
========================================================= */

async function main() {

  console.log(
    `Building standings for ${TARGET_DATE}`
  );


  const affiliates =
    await getBrewersAffiliates();


  console.log(
    `Found ${affiliates.length} Brewers affiliates.`
  );


  const standings = [];


  /*
   * Cache league calls because Blue
   * and Gold can share the same league.
   */

  const cache =
    new Map();


  for (
    const affiliate of affiliates
  ) {

    const cacheKey =
      [
        affiliate.leagueId,
        affiliate.divisionId
      ].join(":");


    let result;


    if (
      cache.has(cacheKey)
    ) {

      const cached =
        cache.get(cacheKey);


      /*
       * We still need the correct
       * Brewers affiliate highlighted.
       */
      result =
        JSON.parse(
          JSON.stringify(cached)
        );


      result.affiliate =
        affiliate.name;

      result.affiliateTeamId =
        affiliate.teamId;

      result.level =
        affiliate.level;


      result.teams =
        result.teams.map(team => ({
          ...team,

          isBrewersAffiliate:
            team.teamId ===
              affiliate.teamId
        }));


    } else {

      result =
        await getLeagueStandings(
          affiliate
        );


      if (result) {

        cache.set(
          cacheKey,
          result
        );
      }
    }


    if (result) {

      standings.push(
        result
      );
    }
  }


  const output = {

    date:
      TARGET_DATE,

    season:
      SEASON,

    generatedAt:
      new Date()
        .toISOString(),

    standings
  };


  const outputFile =
    path.join(
      process.cwd(),
      "data",
      "standings.json"
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

    console.error(error);

    process.exit(1);

  });
