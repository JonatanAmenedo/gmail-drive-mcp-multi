# gmail-drive-mcp-multi
A Model Context Protocol (MCP) server with native **multi-account** support for **Gmail and Google Drive**. Run a single server instance and address any of your connected Google accounts on a per-call basis — no need to spin up one server per account.
This project is a fork of [`dmorrill/gmail-mcp-multi`](https://github.com/dmorrill/gmail-mcp-multi) (MIT). It keeps the original multi-account Gmail foundation and adds a full set of Google Drive tools (search, read/export, create, upload, copy, move, rename, delete, and binary download).
> Works with Claude Code, Claude Desktop, Cursor, or any MCP-compatible client that supports stdio servers.
## Features
- **Multi-account, one server** — unlimited Google accounts from a single instance; pick the account on each tool call.
- **Friendly aliases** — refer to accounts as `work` or `personal` instead of full email addresses.
- **Gmail** — search, read, send, label, and modify messages.
- **Google Drive** — search, inspect metadata, read/export content, create folders, upload, copy, move, rename, delete (trash or permanent), and download files to disk.
- **Auto token refresh** — OAuth tokens are refreshed automatically and re-persisted.
- **Local-only token storage** — credentials live on your machine under `~/.gmail-mcp/`; no third-party service involved.
## Prerequisites
- **Node.js 18+**
- A **Google Cloud project** with OAuth credentials (Desktop app type)
- An **MCP client** (Claude Code, Claude Desktop, Cursor, etc.)
## Installation
```bash
git clone https://github.com/JonatanAmenedo/gmail-drive-mcp-multi.git
cd gmail-drive-mcp-multi
npm install
npm run build
```
The built entry point is `dist/index.js`.
## Google Cloud setup
1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. **Enable APIs**: enable both the **Gmail API** and the **Google Drive API**.
3. **OAuth consent screen**: configure it (External is fine for personal use). Add your Google account(s) as **Test users**.
4. **Scopes**: add the scopes the server requests:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.compose`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.labels`
   - `https://www.googleapis.com/auth/drive` *(full read/write/delete on Drive)*
5. **Credentials**: create an **OAuth client ID** of type **Desktop app** and download the JSON.
6. Save that JSON as **`~/.gmail-mcp/oauth-keys.json`** (see [oauth-keys.example.json](./oauth-keys.example.json) for the expected shape). Do **not** commit it.
### Two important notes
- **The `drive` scope is "restricted."** You'll see an "app not verified" screen during sign-in. For personal use you don't need Google verification — click **Advanced → Continue**. Verification is only required to distribute the app to external users.
- **Refresh-token expiry.** If your OAuth consent screen stays in **Testing** status, refresh tokens expire after **7 days** and you'll have to re-authenticate. To avoid this, set the publishing status to **In production** (this is *not* the same as submitting for verification — an unverified app in production still works for your own accounts, with a user cap and the warning screen).
## Configure your MCP client
The server runs over **stdio**. Point your client at the built `dist/index.js` using Node.
**Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "gmail-drive": {
      "command": "node",
      "args": ["/absolute/path/to/gmail-drive-mcp-multi/dist/index.js"]
    }
  }
}
```
**Claude Code** — add it with the CLI or in `~/.claude.json`:
```json
{
  "mcpServers": {
    "gmail-drive": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/gmail-drive-mcp-multi/dist/index.js"]
    }
  }
}
```
Restart the client fully so it loads the server.
## Authenticate accounts
Once the server shows up in your client, add each account with the `authenticate` tool. The browser opens a Google consent screen (Gmail + Drive); approve it and the tab confirms success.
```
authenticate({ alias: "work",     email: "you@company.com" })
authenticate({ alias: "personal", email: "you@gmail.com" })
```
Tokens are written to `~/.gmail-mcp/accounts/<alias>/credentials.json`.
## Tools
Every tool takes an `account` parameter (an alias or full email).
### Account management
| Tool | Description |
| --- | --- |
| `list_accounts` | List configured accounts and their auth status |
| `authenticate` | Add or re-authenticate an account (opens OAuth in the browser) |
### Gmail
| Tool | Description |
| --- | --- |
| `search_emails` | Search using Gmail query syntax (e.g. `in:inbox is:unread`) |
| `read_email` | Read the full content of a message by ID |
| `send_email` | Send a new email |
| `modify_email` | Add/remove labels, mark read/unread |
| `list_labels` | List all labels for the account |
### Google Drive
| Tool | Parameters | Description |
| --- | --- | --- |
| `drive_search` | `account`, `query`, `maxResults?` | Search files using Drive query syntax |
| `drive_get_metadata` | `account`, `fileId` | File metadata (name, type, size, parents, links) |
| `drive_read_content` | `account`, `fileId` | Read textual content; exports Docs/Sheets/Slides to text; binaries return metadata only |
| `drive_create_folder` | `account`, `name`, `parentId?` | Create a folder (at root if no parent) |
| `drive_upload` | `account`, `localPath`, `name?`, `parentId?`, `mimeType?` | Upload a local file to Drive |
| `drive_copy` | `account`, `fileId`, `name?`, `parentId?` | Copy a file, optionally rename / reparent |
| `drive_move` | `account`, `fileId`, `newParentId` | Move a file to another folder |
| `drive_rename` | `account`, `fileId`, `newName` | Rename a file |
| `drive_delete` | `account`, `fileId`, `permanent?` | Trash (default) or permanently delete a file |
| `drive_download` | `account`, `fileId`, `destPath`, `exportMimeType?` | Stream a file to disk; Google-native files are exported (Docs/Slides → PDF, Sheets → XLSX by default) |
## Use as a Claude Code / Cowork plugin

This repository is also a Claude Code plugin: it ships a plugin manifest, an `.mcp.json` that
registers the server, and a skill that routes natural-language account references to the right
alias. (It replaces the former separate `gmail-mcp-multi-cowork` wrapper repo.)

```
.claude-plugin/plugin.json       # plugin manifest
.claude-plugin/marketplace.json  # lets this directory be added as a local marketplace
.mcp.json                        # registers the server at ${CLAUDE_PLUGIN_ROOT}/dist/index.js
skills/gmail-accounts/SKILL.md   # natural-language account routing
```

Build first (`npm install && npm run build`) — the plugin runs the compiled `dist/`, which is not
committed.

**Install it as a plugin:**

```bash
claude plugin marketplace add /absolute/path/to/gmail-drive-mcp-multi
claude plugin install gmail-drive-mcp-multi@gmail-drive-mcp-multi-local
```

If you already registered the server manually (see [Configure your MCP client](#configure-your-mcp-client)),
remove that entry first — otherwise the same tools are exposed twice.

**Using the skill without installing the plugin:** symlink it into your user skills directory, which
keeps a single source of truth:

```bash
ln -s /absolute/path/to/gmail-drive-mcp-multi/skills/gmail-accounts ~/.claude/skills/gmail-accounts
```

### Local account map

The committed skill is generic: it discovers aliases with `list_accounts`. To give Claude your own
alias → mailbox mapping, create `skills/gmail-accounts/accounts.local.md` with a table of aliases,
addresses and context. The skill reads it when present, and `.gitignore` keeps it out of the
repository — it contains real addresses.

### Notes and limitations

- **Local only.** The server is a Node stdio process on your machine. It won't work in remote
  sessions or on another machine without `node` and a copy of `~/.gmail-mcp/`.
- **OAuth Testing mode.** Refresh tokens for accounts outside the OAuth project's organization
  expire every 7 days; re-run `authenticate` when that happens.
- **`node_modules` is heavy.** `googleapis` pulls in definitions for every Google API (~136 MB), so
  packaging the plugin with bundled dependencies produces a large archive.

## Storage layout
```
~/.gmail-mcp/
├── config.json              # Account aliases and settings
├── oauth-keys.json          # Your Google OAuth app credentials (never commit)
└── accounts/
    ├── work/
    │   └── credentials.json # Per-account OAuth tokens (never commit)
    └── personal/
        └── credentials.json
```
## Security
OAuth tokens and app credentials are stored as **plaintext JSON on your local disk**. Anyone with read access to your home directory can read them. See [SECURITY.md](./SECURITY.md) for guidance on scopes, storage, and reporting issues. In short: never commit anything under `~/.gmail-mcp/`, and only grant the scopes you actually need.
## Troubleshooting
- **Tools don't appear** — restart the MCP client completely (e.g. Cmd+Q + reopen). Confirm the absolute path to `dist/index.js` and that `node` is on PATH. Check your client's MCP logs.
- **`invalid_grant` after ~7 days** — your OAuth consent screen is in Testing mode. Switch it to In production, or re-authenticate the affected accounts.
- **"App not verified" screen** — expected with the restricted `drive` scope. For personal use, click **Advanced → Continue**.
- **OAuth redirect fails** — make sure `http://localhost` is listed as an authorized redirect URI on the OAuth client.
## Development
```bash
npm install
npm run build      # compile src/ -> dist/
```
## License & attribution
Distributed under the **MIT License** (see [LICENSE](./LICENSE)).
This is a derivative of [`dmorrill/gmail-mcp-multi`](https://github.com/dmorrill/gmail-mcp-multi), used under the MIT License. The original multi-account Gmail server and its authors retain their copyright; the Google Drive tooling and related modifications are added by this fork's author. The original copyright notice is preserved in `LICENSE`.
## Acknowledgements
- [`dmorrill/gmail-mcp-multi`](https://github.com/dmorrill/gmail-mcp-multi) — the multi-account Gmail foundation this project builds on
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol)
- [googleapis](https://www.npmjs.com/package/googleapis)
---
*Not affiliated with, endorsed by, or sponsored by Google or Anthropic. "Gmail" and "Google Drive" are trademarks of Google LLC.*
