import fetch from "node-fetch";

export const handler = async (event) => {
  const cookie = event.headers.cookie || "";
  const token = cookie.split("patreon_token=")[1]?.split(";")[0];

  if (!token) {
    return {
      statusCode: 200,
      body: JSON.stringify({ accessLevel: "free" })
    };
  }

  const res = await fetch(
    "https://www.patreon.com/api/oauth2/v2/identity?include=memberships.currently_entitled_tiers&fields%5Bmember%5D=patron_status,currently_entitled_amount_cents&fields%5Btier%5D=title,amount_cents",
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const data = await res.json();

  const members = (data.included || []).filter(item => item.type === "member");
  const tiers = (data.included || []).filter(item => item.type === "tier");

  const activeMember = members.find(member =>
    member.attributes?.patron_status === "active_patron"
  );

  if (!activeMember) {
    return {
      statusCode: 200,
      body: JSON.stringify({ accessLevel: "free" })
    };
  }

  const highestTierCents = Math.max(
    0,
    ...tiers.map(tier => tier.attributes?.amount_cents || 0)
  );

  let accessLevel = "free";

  if (highestTierCents >= 1200) {
    accessLevel = "premium";
  } else if (highestTierCents >= 600) {
    accessLevel = "rankings";
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ accessLevel })
  };
};
