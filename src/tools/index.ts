import { Tool, CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { AccountManager } from "../accounts.js";
import { GmailClient } from "../gmail.js";
import { authenticate } from "../auth.js";

export const tools: Tool[] = [
  {
    name: "list_accounts",
    description: "List all configured Gmail accounts and their authentication status",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "authenticate",
    description: "Add or re-authenticate a Gmail account. Opens browser for OAuth flow.",
    inputSchema: {
      type: "object",
      properties: {
        alias: {
          type: "string",
          description: "Friendly name for this account (e.g., 'work', 'personal')",
        },
        email: {
          type: "string",
          description: "Email address for this account (used as login hint)",
        },
      },
      required: ["alias"],
    },
  },
  {
    name: "search_emails",
    description: "Search for emails using Gmail query syntax",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
        query: {
          type: "string",
          description: "Gmail search query (e.g., 'in:inbox is:unread')",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results (default: 10)",
        },
      },
      required: ["account", "query"],
    },
  },
  {
    name: "read_email",
    description: "Get the full content of an email by ID",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
        messageId: {
          type: "string",
          description: "The ID of the email message",
        },
      },
      required: ["account", "messageId"],
    },
  },
  {
    name: "send_email",
    description: "Send a new email",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
        to: {
          type: "array",
          items: { type: "string" },
          description: "Recipient email addresses",
        },
        subject: {
          type: "string",
          description: "Email subject",
        },
        body: {
          type: "string",
          description: "Email body (plain text)",
        },
        cc: {
          type: "array",
          items: { type: "string" },
          description: "CC recipients",
        },
        bcc: {
          type: "array",
          items: { type: "string" },
          description: "BCC recipients",
        },
      },
      required: ["account", "to", "subject", "body"],
    },
  },
  {
    name: "list_labels",
    description: "Get all labels for an account",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
      },
      required: ["account"],
    },
  },
  {
    name: "modify_email",
    description: "Modify email labels (add/remove labels, mark read/unread)",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
        messageId: {
          type: "string",
          description: "The ID of the email message",
        },
        addLabelIds: {
          type: "array",
          items: { type: "string" },
          description: "Label IDs to add",
        },
        removeLabelIds: {
          type: "array",
          items: { type: "string" },
          description: "Label IDs to remove",
        },
      },
      required: ["account", "messageId"],
    },
  },
];

export async function handleToolCall(
  request: CallToolRequest,
  accountManager: AccountManager,
  gmailClient: GmailClient
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_accounts": {
        const accounts = accountManager.listAccounts();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ accounts }, null, 2),
            },
          ],
        };
      }

      case "authenticate": {
        const { alias, email } = args as { alias: string; email?: string };
        const result = await authenticate(accountManager, alias, email);
        gmailClient.clearClient(alias); // Clear cached client to force reload
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `✓ ${result.message}`
                : `✗ ${result.message}`,
            },
          ],
        };
      }

      case "search_emails": {
        const { account, query, maxResults = 10 } = args as {
          account: string;
          query: string;
          maxResults?: number;
        };
        const client = await gmailClient.getClient(account);
        const response = await client.users.messages.list({
          userId: "me",
          q: query,
          maxResults,
        });

        const messages = response.data.messages || [];
        const results = await Promise.all(
          messages.map(async (msg) => {
            const full = await client.users.messages.get({
              userId: "me",
              id: msg.id!,
              format: "metadata",
              metadataHeaders: ["From", "To", "Subject", "Date"],
            });
            const headers = full.data.payload?.headers || [];
            return {
              id: msg.id,
              subject: headers.find((h) => h.name === "Subject")?.value,
              from: headers.find((h) => h.name === "From")?.value,
              date: headers.find((h) => h.name === "Date")?.value,
            };
          })
        );

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "read_email": {
        const { account, messageId } = args as {
          account: string;
          messageId: string;
        };
        const client = await gmailClient.getClient(account);
        const response = await client.users.messages.get({
          userId: "me",
          id: messageId,
          format: "full",
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      }

      case "list_labels": {
        const { account } = args as { account: string };
        const client = await gmailClient.getClient(account);
        const response = await client.users.labels.list({ userId: "me" });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data.labels, null, 2) },
          ],
        };
      }

      case "send_email": {
        const { account, to, subject, body, cc, bcc } = args as {
          account: string;
          to: string[];
          subject: string;
          body: string;
          cc?: string[];
          bcc?: string[];
        };
        const client = await gmailClient.getClient(account);

        // Build email
        const messageParts = [
          `To: ${to.join(", ")}`,
          `Subject: ${subject}`,
        ];
        if (cc && cc.length > 0) {
          messageParts.push(`Cc: ${cc.join(", ")}`);
        }
        if (bcc && bcc.length > 0) {
          messageParts.push(`Bcc: ${bcc.join(", ")}`);
        }
        messageParts.push("Content-Type: text/plain; charset=utf-8");
        messageParts.push("");
        messageParts.push(body);

        const rawMessage = Buffer.from(messageParts.join("\r\n"))
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        const response = await client.users.messages.send({
          userId: "me",
          requestBody: { raw: rawMessage },
        });

        return {
          content: [
            {
              type: "text",
              text: `Email sent successfully. Message ID: ${response.data.id}`,
            },
          ],
        };
      }

      case "modify_email": {
        const { account, messageId, addLabelIds, removeLabelIds } = args as {
          account: string;
          messageId: string;
          addLabelIds?: string[];
          removeLabelIds?: string[];
        };
        const client = await gmailClient.getClient(account);

        await client.users.messages.modify({
          userId: "me",
          id: messageId,
          requestBody: {
            addLabelIds: addLabelIds || [],
            removeLabelIds: removeLabelIds || [],
          },
        });

        return {
          content: [
            {
              type: "text",
              text: `Email ${messageId} modified successfully.`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
    };
  }
}
