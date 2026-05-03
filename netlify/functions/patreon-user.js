import fetch from "node-fetch";

export const handler = async (event) => {
  const cookie = event.headers.cookie || "";
  const token = cookie.split("patreon_token=")[1]?.split(";")[0];

  if (!token) {
    return { statusCode: 401 };
  }

  const res = await fetch(
    "https://www.patreon.com/api/oauth2/v2/identity?include=memberships.currently_entitled_tiers",
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const data = await res.json();

  const memberships = data.included || [];

  const isActive = memberships.some(m =>
    m.type === "tier"
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ isActive })
  };
};
