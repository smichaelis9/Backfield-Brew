exports.handler = async () => {
  const clientId = process.env.PATREON_CLIENT_ID;
  const redirectUri = process.env.PATREON_REDIRECT_URI;

  return {
    statusCode: 302,
    headers: {
      Location: `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=identity identity.memberships`
    }
  };
};
