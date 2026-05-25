const dotenv = require("dotenv");
const { JWT } = require("google-auth-library");

dotenv.config();

function getGoogleDriveCredentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyJson = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !keyJson) return null;
  
  try {
    if (keyJson.trim().startsWith("{")) {
      const parsed = JSON.parse(keyJson);
      return {
        clientEmail: parsed.client_email || email,
        privateKey: parsed.private_key
      };
    }
  } catch (err) {
    console.error("JSON parse error:", err);
  }
  
  return {
    clientEmail: email,
    privateKey: keyJson.replace(/\\n/g, "\n")
  };
}

async function testAuth() {
  const credentials = getGoogleDriveCredentials();
  if (!credentials) {
    console.log("No credentials found in process.env");
    return;
  }
  
  console.log("Client Email:", credentials.clientEmail);
  console.log("Private Key starts with:", credentials.privateKey ? credentials.privateKey.substring(0, 50) : "undefined");
  
  try {
    const auth = new JWT({
      email: credentials.clientEmail,
      key: credentials.privateKey,
      scopes: ["https://www.googleapis.com/auth/drive"]
    });
    
    console.log("Authorizing...");
    const tokens = await auth.authorize();
    console.log("Authorized successfully!");
    console.log("Access token received:", tokens.access_token ? "Yes" : "No");
  } catch (err) {
    console.error("Auth error:", err);
  }
}

testAuth();
