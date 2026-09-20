---
name: gmail-accounts
description: Resolve which Gmail/Drive account alias to use when calling the gmail MCP tools. Use when the user refers to a mailbox or drive by context rather than by alias ("my personal email", "the work one", "mi correo personal", a company or domain name, "buzón de X"), or asks about email/Drive without naming an account and a tool needs its `account` parameter.
---

# Gmail / Drive account routing

Every tool in the `gmail` MCP (`search_emails`, `read_email`, `send_email`, `modify_email`,
`list_labels`, `drive_search`, `drive_upload`, …) takes an `account` parameter: an **alias**
identifying which Google account to act on — never a full email address.

## Finding the aliases

1. If `accounts.local.md` exists next to this file, read it. It holds this machine's alias map
   (alias → email → context) and any user-specific routing preferences. It takes precedence.
2. Otherwise call `list_accounts({})` to discover the configured aliases before doing anything else.

## Routing rules

Apply in order:

1. **Explicit alias** — the user names an alias ("welpay", "personal"): use it directly.
2. **Domain or company** — a domain or company name that matches an alias's email: use that alias.
3. **Role** — "personal", "mi gmail" → the personal alias; "work", "trabajo" → the work alias, but
   if several accounts are work accounts this is ambiguous, see 4.
4. **Ambiguous or unspecified** — ask the user, listing the configured aliases. Do not guess
   silently, and never default to a personal mailbox for a work-context question.
5. **All accounts** — for "search across all my accounts", call the tool once per alias and present
   the results grouped and tagged by alias.

## Patterns

- **Unread inbox, one account:** `search_emails({ account: "<alias>", query: "in:inbox is:unread", maxResults: 20 })`
- **Cross-account sweep:** same query per alias, results grouped by alias.
- **Sending:** confirm the sending account before `send_email` — the reply-to identity is that
  account's address. "Reply from <company>" → that company's alias.
- **Drive:** the same aliases apply to every `drive_*` tool; a file lives in one account's Drive, so
  resolve the alias before searching.

## When auth fails

An auth error (typically an expired refresh token) means that alias needs re-authentication:
`authenticate({ alias: "<alias>", email: "<email>" })`

While the Google OAuth consent screen is in **Testing** status, refresh tokens expire every 7 days
for accounts outside the OAuth project's organization.

## Don't

- Don't pass an email address as `account` — pass the alias.
- Don't invent aliases that aren't configured.
- Don't silently pick a default when the account is ambiguous.
