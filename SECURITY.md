# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it
privately via [GitHub Security Advisories](https://github.com/JonatanAmenedo/gmail-drive-mcp-multi/security/advisories/new).

**Do not open a public issue for security reports.**

We aim to acknowledge reports within 7 days and provide a more detailed
response (with a plan or a fix) within 14 days.

## Credential Handling

This project handles OAuth credentials for Google APIs (Gmail and Drive).
Credentials are stored **locally** on the user's machine under
`~/.gmail-mcp/` and are **never** transmitted anywhere except to Google's
official APIs.

The repository's `.gitignore` excludes:

- `credentials.json` and `*.credentials.json` — per-account OAuth tokens
- `oauth-keys.json` — your Google Cloud OAuth client (use
  `oauth-keys.example.json` as a template)
- `.env` and `.env.local`

If you ever accidentally commit a credential file:

1. **Revoke the affected token / OAuth client immediately** in the
   [Google Cloud Console](https://console.cloud.google.com/).
2. Rewrite the affected git history. If the commit was pushed publicly,
   treat the credential as fully compromised.
3. Issue new credentials and re-authenticate.

## Scope of Access

The server requests these OAuth scopes:

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.compose`
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/gmail.labels`
- `https://www.googleapis.com/auth/drive` (full read/write/delete on Drive)

The Drive scope grants the server the ability to **read, modify and
permanently delete** files in the connected accounts. Review the tool
descriptions before running destructive operations (`drive_delete` with
`permanent=true` cannot be undone).

## Supported Versions

Only the latest released version receives security updates.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✓         |
