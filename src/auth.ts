import { google } from "googleapis";
import * as http from "http";
import * as fs from "fs";
import * as url from "url";
import { AccountManager } from "./accounts.js";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/gmail.settings.sharing",
  "https://www.googleapis.com/auth/drive",
];

export interface AuthResult {
  success: boolean;
  message: string;
  alias?: string;
  email?: string;
}

export async function authenticate(
  accountManager: AccountManager,
  alias: string,
  emailHint?: string
): Promise<AuthResult> {
  const oauthKeysPath = accountManager.getOAuthKeysPath();

  if (!fs.existsSync(oauthKeysPath)) {
    return {
      success: false,
      message: `OAuth keys not found. Please create ${oauthKeysPath} with your Google Cloud OAuth credentials.`,
    };
  }

  const oauthKeys = JSON.parse(fs.readFileSync(oauthKeysPath, "utf-8"));
  const { client_id, client_secret } = oauthKeys.installed;

  // Use a random port to avoid conflicts
  const port = 3000 + Math.floor(Math.random() * 1000);
  const redirectUri = `http://localhost:${port}`;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    login_hint: emailHint,
  });

  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url || "", true);
        const code = parsedUrl.query.code as string;

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h1>Error: No authorization code received</h1>");
          server.close();
          resolve({
            success: false,
            message: "No authorization code received from Google",
          });
          return;
        }

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);

        // Get user email
        oauth2Client.setCredentials(tokens);
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: "me" });
        const email = profile.data.emailAddress || emailHint || "unknown";

        // Save credentials
        accountManager.addAccount(alias, email);
        const credentialsPath = accountManager.getCredentialsPath(alias);
        fs.writeFileSync(credentialsPath, JSON.stringify(tokens, null, 2));

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
              <div style="text-align: center;">
                <h1 style="color: #22c55e;">✓ Authentication Successful!</h1>
                <p>Account <strong>${alias}</strong> (${email}) has been authenticated.</p>
                <p>You can close this window.</p>
              </div>
            </body>
          </html>
        `);

        server.close();
        resolve({
          success: true,
          message: `Successfully authenticated ${alias} (${email})`,
          alias,
          email,
        });
      } catch (error) {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(`<h1>Error: ${error instanceof Error ? error.message : "Unknown error"}</h1>`);
        server.close();
        resolve({
          success: false,
          message: `Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    });

    server.listen(port, () => {
      console.error(`\n🔐 Opening browser for authentication...`);
      console.error(`If browser doesn't open, visit: ${authUrl}\n`);

      // Open browser
      const open = (url: string) => {
        const { exec } = require("child_process");
        const platform = process.platform;
        if (platform === "darwin") {
          exec(`open "${url}"`);
        } else if (platform === "win32") {
          exec(`start "${url}"`);
        } else {
          exec(`xdg-open "${url}"`);
        }
      };

      open(authUrl);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      resolve({
        success: false,
        message: "Authentication timed out after 5 minutes",
      });
    }, 5 * 60 * 1000);
  });
}
