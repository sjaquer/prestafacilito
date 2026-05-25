import "dotenv/config";
import { JWT } from "google-auth-library";

const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

function getEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function getGoogleDriveCredentials() {
  const rawPrivateKey = getEnv("GOOGLE_PRIVATE_KEY");

  if (rawPrivateKey.startsWith("{")) {
    try {
      const parsed = JSON.parse(rawPrivateKey);
      if (parsed?.client_email && parsed?.private_key) {
        return {
          clientEmail: String(parsed.client_email),
          privateKey: String(parsed.private_key).replace(/\\n/g, "\n")
        };
      }
    } catch (error) {
    }
  }

  const clientEmail = getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey };
}

async function testUpload() {
  const credentials = getGoogleDriveCredentials();
  if (!credentials) {
    console.error("No credentials");
    return;
  }
  
  const auth = new JWT({
    email: credentials.clientEmail,
    key: credentials.privateKey,
    scopes: [GOOGLE_DRIVE_SCOPE]
  });

  const tokens = await auth.authorize();
  const accessToken = tokens.access_token;
  
  const folderId = getEnv("GOOGLE_DRIVE_FOLDER_ID");
  console.log("Folder ID:", folderId);

  const boundary = `----prestafacilito-test`;
  const metadata: any = { name: "test.txt" };
  if (folderId) metadata.parents = [folderId];

  const multipartBody = Buffer.from([
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: text/plain`,
    "",
    "Test content",
    `\r\n--${boundary}--`
  ].join("\r\n"), "utf8");

  const uploadResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    }
  );

  if (!uploadResponse.ok) {
    console.error("Upload failed:", await uploadResponse.text());
  } else {
    console.log("Upload succeeded:", await uploadResponse.json());
  }
}

testUpload().catch(console.error);
