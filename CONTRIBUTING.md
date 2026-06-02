# Contributing

Thanks for your interest in improving `gmail-drive-mcp-multi`.

## Development Setup

1. Clone the repo:

   ```bash
   git clone https://github.com/JonatanAmenedo/gmail-drive-mcp-multi.git
   cd gmail-drive-mcp-multi
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build:

   ```bash
   npm run build
   ```

4. Watch mode for development:

   ```bash
   npm run dev
   ```

You'll need a Google Cloud OAuth client (Desktop app type) with the Gmail
and Drive APIs enabled. See [README.md](README.md) for the full setup steps.
Copy `oauth-keys.example.json` to `~/.gmail-mcp/oauth-keys.json` and fill in
your real values — **never commit your actual `oauth-keys.json`**.

## Reporting Issues

Open an issue on GitHub. Please include:

- What you did
- What you expected to happen
- What actually happened
- Your Node.js version and OS

For **security vulnerabilities**, follow [SECURITY.md](SECURITY.md) — do not
file a public issue.

## Pull Requests

- Branch from `main`.
- Keep PRs focused: one logical change per PR.
- Run `npm run build` and make sure it compiles before submitting.
- Update docs (README.md, etc.) if you change user-facing behavior.
- By submitting a PR you agree that your contribution is licensed under the
  project's MIT License.

## Code Style

- TypeScript, strict mode.
- 2-space indentation.
- Match the conventions in the surrounding code; new tools should follow the
  same declaration/handler pattern as the existing Drive and Gmail tools in
  `src/tools/index.ts`.

## Commit Messages

Short imperative summary on the first line (under 72 characters). Add a body
paragraph if the change isn't self-evident from the diff.
