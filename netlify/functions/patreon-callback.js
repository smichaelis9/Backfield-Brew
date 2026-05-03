import fetch from "node-fetch";

exports.handler = async (event) => {
  const code = event.queryStringParameters.code;

  const res = await fetch("https://www.patreon.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      grant_type: "authorization_code",
      client_id: process.env.PATREON_CLIENT_ID,
      client_secret: process.env.PATREON_CLIENT_SECRET,
      redirect_uri: process.env.PATREON_REDIRECT_URI
    })
  });

  const data = await res.json();

  return {
    statusCode: 302,
    headers: {
      "Set-Cookie": `patreon_token=${data.access_token}; Path=/; HttpOnly`,
      Location: "/"
    }
  };
};
