import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { GmailClient } from "./gmail.js";

/**
 * Gmail settings tools: filters, forwarding addresses and label creation.
 *
 * Most of these require the `gmail.settings.basic` OAuth scope. Creating a
 * forwarding address is the exception: Google requires `gmail.settings.sharing`
 * for forwardingAddresses.create, while listing them only needs basic — so
 * list_forwarding_addresses can succeed on an account where
 * create_forwarding_address returns 403.
 *
 * Accounts authenticated before a scope was added must be re-authenticated with
 * the `authenticate` tool, otherwise Google returns a 403 insufficient-scope
 * error.
 */

const ACCOUNT_PROP = {
  type: "string" as const,
  description: "Account alias or email to use",
};

export const filterTools: Tool[] = [
  {
    name: "list_filters",
    description:
      "List all Gmail filters for an account, with their criteria and actions.",
    inputSchema: {
      type: "object",
      properties: { account: ACCOUNT_PROP },
      required: ["account"],
    },
  },
  {
    name: "create_filter",
    description:
      "Create a Gmail filter. Give at least one criterion (from, to, subject, query) " +
      "and at least one action (archive, markRead, star, labelName/addLabelIds, forwardTo). " +
      "Applies to new incoming mail only; it does not touch existing messages. " +
      "forwardTo requires a verified forwarding address (see create_forwarding_address).",
    inputSchema: {
      type: "object",
      properties: {
        account: ACCOUNT_PROP,
        from: {
          type: "string",
          description: "Match the sender, e.g. 'soporte@alan.eu' or '@scalapay.com'",
        },
        to: { type: "string", description: "Match a recipient address" },
        subject: {
          type: "string",
          description: "Match words in the subject, e.g. 'Settlement Report'",
        },
        query: {
          type: "string",
          description:
            "Raw Gmail search syntax for anything the other fields cannot express, " +
            "e.g. 'has:attachment filename:csv'",
        },
        negatedQuery: {
          type: "string",
          description: "Gmail search syntax that must NOT match",
        },
        hasAttachment: {
          type: "boolean",
          description: "Only match messages with attachments",
        },
        archive: {
          type: "boolean",
          description: "Skip the inbox (auto-archive on arrival)",
        },
        markRead: { type: "boolean", description: "Mark as read on arrival" },
        star: { type: "boolean", description: "Star the message" },
        markImportant: {
          type: "boolean",
          description: "Force 'important'; set false to force 'not important'",
        },
        labelName: {
          type: "string",
          description:
            "Apply this label, creating it if it does not exist. Nested labels use '/'.",
        },
        addLabelIds: {
          type: "array",
          items: { type: "string" },
          description: "Label IDs to add, for labels you already resolved",
        },
        removeLabelIds: {
          type: "array",
          items: { type: "string" },
          description: "Label IDs to remove",
        },
        forwardTo: {
          type: "string",
          description:
            "Forward matching mail to this address. Must already be verified on the account.",
        },
      },
      required: ["account"],
    },
  },
  {
    name: "delete_filter",
    description:
      "Delete a Gmail filter by ID. Get IDs from list_filters. This cannot be undone.",
    inputSchema: {
      type: "object",
      properties: {
        account: ACCOUNT_PROP,
        filterId: { type: "string", description: "The filter ID to delete" },
      },
      required: ["account", "filterId"],
    },
  },
  {
    name: "list_forwarding_addresses",
    description:
      "List forwarding addresses on an account and whether each one is verified. " +
      "Only verified addresses can be used as a filter's forwardTo.",
    inputSchema: {
      type: "object",
      properties: { account: ACCOUNT_PROP },
      required: ["account"],
    },
  },
  {
    name: "create_forwarding_address",
    description:
      "Register a forwarding address. Google emails a verification link to that " +
      "address and a person has to click it; until then the address stays pending " +
      "and filters cannot forward to it.",
    inputSchema: {
      type: "object",
      properties: {
        account: ACCOUNT_PROP,
        emailAddress: {
          type: "string",
          description: "The destination address to register",
        },
      },
      required: ["account", "emailAddress"],
    },
  },
  {
    name: "create_label",
    description:
      "Create a label on an account. Nested labels use '/', e.g. 'Finance/Settlements'.",
    inputSchema: {
      type: "object",
      properties: {
        account: ACCOUNT_PROP,
        name: { type: "string", description: "Label name" },
      },
      required: ["account", "name"],
    },
  },
];

export const filterToolNames = new Set(filterTools.map((t) => t.name));

type ToolResult = { content: Array<{ type: "text"; text: string }> };

const text = (t: string): ToolResult => ({ content: [{ type: "text", text: t }] });
const json = (v: unknown): ToolResult => text(JSON.stringify(v, null, 2));

/** Find a label by name (case-insensitive), creating it when absent. */
async function resolveLabelId(
  client: any,
  name: string
): Promise<{ id: string; created: boolean }> {
  const existing = await client.users.labels.list({ userId: "me" });
  const match = (existing.data.labels || []).find(
    (l: any) => (l.name || "").toLowerCase() === name.toLowerCase()
  );
  if (match?.id) return { id: match.id, created: false };

  const created = await client.users.labels.create({
    userId: "me",
    requestBody: {
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });
  if (!created.data.id) throw new Error(`Could not create label "${name}"`);
  return { id: created.data.id, created: true };
}

/** The scope Google actually enforces for each settings tool. */
const TOOL_SCOPES: Record<string, string> = {
  create_forwarding_address: "gmail.settings.sharing",
};

function scopeHint(error: unknown, toolName: string): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/insufficient|scope|403/i.test(message)) {
    const scope = TOOL_SCOPES[toolName] ?? "gmail.settings.basic";
    return `${message}\n\nThis tool needs the ${scope} scope. ` +
      `Re-run the authenticate tool for this account to grant it. ` +
      `If it still fails, add ${scope} to the OAuth consent screen in the ` +
      `Google Cloud Console first — the consent screen only grants scopes it lists.`;
  }
  return message;
}

export async function handleFilterTool(
  name: string,
  args: Record<string, any>,
  gmailClient: GmailClient
): Promise<ToolResult> {
  const account = args.account as string;
  const client: any = await gmailClient.getClient(account);

  try {
    switch (name) {
      case "list_filters": {
        const res = await client.users.settings.filters.list({ userId: "me" });
        const filters = res.data.filter || [];
        if (filters.length === 0) return text("No filters configured on this account.");
        return json(filters);
      }

      case "create_filter": {
        const criteria: Record<string, any> = {};
        if (args.from) criteria.from = args.from;
        if (args.to) criteria.to = args.to;
        if (args.subject) criteria.subject = args.subject;
        if (args.query) criteria.query = args.query;
        if (args.negatedQuery) criteria.negatedQuery = args.negatedQuery;
        if (args.hasAttachment) criteria.hasAttachment = true;

        if (Object.keys(criteria).length === 0) {
          return text(
            "Refusing to create a filter with no criteria — it would match every message. " +
              "Give at least one of: from, to, subject, query, hasAttachment."
          );
        }

        const addLabelIds: string[] = [...(args.addLabelIds || [])];
        const removeLabelIds: string[] = [...(args.removeLabelIds || [])];
        const notes: string[] = [];

        if (args.labelName) {
          const { id, created } = await resolveLabelId(client, args.labelName);
          addLabelIds.push(id);
          notes.push(
            created
              ? `Created label "${args.labelName}" (${id}).`
              : `Reused existing label "${args.labelName}" (${id}).`
          );
        }

        if (args.archive) removeLabelIds.push("INBOX");
        if (args.markRead) removeLabelIds.push("UNREAD");
        if (args.star) addLabelIds.push("STARRED");
        if (args.markImportant === true) addLabelIds.push("IMPORTANT");
        if (args.markImportant === false) removeLabelIds.push("IMPORTANT");

        const action: Record<string, any> = {};
        if (addLabelIds.length) action.addLabelIds = [...new Set(addLabelIds)];
        if (removeLabelIds.length)
          action.removeLabelIds = [...new Set(removeLabelIds)];
        if (args.forwardTo) action.forward = args.forwardTo;

        if (Object.keys(action).length === 0) {
          return text(
            "Refusing to create a filter with no action. " +
              "Give at least one of: archive, markRead, star, markImportant, labelName, addLabelIds, removeLabelIds, forwardTo."
          );
        }

        if (args.forwardTo) {
          const fwd = await client.users.settings.forwardingAddresses.list({
            userId: "me",
          });
          const entry = (fwd.data.forwardingAddresses || []).find(
            (f: any) =>
              (f.forwardingEmail || "").toLowerCase() ===
              String(args.forwardTo).toLowerCase()
          );
          if (!entry) {
            return text(
              `${args.forwardTo} is not registered as a forwarding address on ${account}. ` +
                `Run create_forwarding_address first, then have someone click the verification link.`
            );
          }
          if (entry.verificationStatus !== "accepted") {
            return text(
              `${args.forwardTo} is registered but not verified (status: ${entry.verificationStatus}). ` +
                `Gmail rejects forwarding filters until the verification link is clicked.`
            );
          }
        }

        const res = await client.users.settings.filters.create({
          userId: "me",
          requestBody: { criteria, action },
        });

        return text(
          [
            `Filter created on ${account} (id: ${res.data.id}).`,
            ...notes,
            `Criteria: ${JSON.stringify(criteria)}`,
            `Action: ${JSON.stringify(action)}`,
            `Applies to new mail only — existing messages are untouched.`,
          ].join("\n")
        );
      }

      case "delete_filter": {
        await client.users.settings.filters.delete({
          userId: "me",
          id: args.filterId,
        });
        return text(`Filter ${args.filterId} deleted from ${account}.`);
      }

      case "list_forwarding_addresses": {
        const res = await client.users.settings.forwardingAddresses.list({
          userId: "me",
        });
        const addresses = res.data.forwardingAddresses || [];
        if (addresses.length === 0)
          return text("No forwarding addresses registered on this account.");
        return json(addresses);
      }

      case "create_forwarding_address": {
        const res = await client.users.settings.forwardingAddresses.create({
          userId: "me",
          requestBody: { forwardingEmail: args.emailAddress },
        });
        return text(
          `Registered ${args.emailAddress} on ${account} ` +
            `(status: ${res.data.verificationStatus}).\n` +
            `Google has emailed a verification link to that address. ` +
            `Someone with access to it must click the link before any filter can forward there.`
        );
      }

      case "create_label": {
        const { id, created } = await resolveLabelId(client, args.name);
        return text(
          created
            ? `Created label "${args.name}" (${id}) on ${account}.`
            : `Label "${args.name}" already existed on ${account} (${id}).`
        );
      }

      default:
        return text(`Unknown settings tool: ${name}`);
    }
  } catch (error) {
    return text(`Error: ${scopeHint(error, name)}`);
  }
}
