import * as fs from "fs";
import * as path from "path";
import { Tool, CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { AccountManager } from "../accounts.js";
import { GmailClient } from "../gmail.js";
import { DriveClient } from "../drive.js";
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
    name: "drive_search",
    description: "Search for files in Google Drive using Drive query syntax",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
        query: {
          type: "string",
          description: "Drive search query (e.g., \"name contains 'informe'\")",
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
    name: "drive_get_metadata",
    description: "Get metadata for a Drive file by ID",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
        fileId: {
          type: "string",
          description: "The Drive file ID",
        },
      },
      required: ["account", "fileId"],
    },
  },
  {
    name: "drive_read_content",
    description:
      "Read the textual content of a Drive file. Google Docs/Slides are exported as text/plain; Google Sheets are exported as CSV (FIRST SHEET ONLY). Plain text/JSON files are downloaded as-is. For any other binary file (image, pdf, zip, ...) the tool returns metadata only and a note, without downloading the content.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
        fileId: {
          type: "string",
          description: "The Drive file ID",
        },
      },
      required: ["account", "fileId"],
    },
  },
  {
    name: "drive_create_folder",
    description: "Create a new folder in Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
        name: {
          type: "string",
          description: "Folder name",
        },
        parentId: {
          type: "string",
          description:
            "Optional parent folder ID. If omitted, the folder is created at the root of My Drive.",
        },
      },
      required: ["account", "name"],
    },
  },
  {
    name: "drive_upload",
    description: "Upload a local file to Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
        localPath: {
          type: "string",
          description: "Absolute path of the local file to upload",
        },
        name: {
          type: "string",
          description:
            "Optional name for the uploaded file. Defaults to the basename of localPath.",
        },
        parentId: {
          type: "string",
          description: "Optional parent folder ID",
        },
        mimeType: {
          type: "string",
          description:
            "Optional MIME type. If omitted, Drive will attempt to infer it.",
        },
      },
      required: ["account", "localPath"],
    },
  },
  {
    name: "drive_copy",
    description: "Copy a Drive file. Optionally rename and/or place into a different parent folder.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
        fileId: {
          type: "string",
          description: "The Drive file ID to copy",
        },
        name: {
          type: "string",
          description: "Optional name for the copy",
        },
        parentId: {
          type: "string",
          description: "Optional destination parent folder ID",
        },
      },
      required: ["account", "fileId"],
    },
  },
  {
    name: "drive_move",
    description: "Move a Drive file to a different parent folder",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
        fileId: {
          type: "string",
          description: "The Drive file ID to move",
        },
        newParentId: {
          type: "string",
          description: "The new parent folder ID",
        },
      },
      required: ["account", "fileId", "newParentId"],
    },
  },
  {
    name: "drive_rename",
    description: "Rename a Drive file",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
        fileId: {
          type: "string",
          description: "The Drive file ID to rename",
        },
        newName: {
          type: "string",
          description: "The new name for the file",
        },
      },
      required: ["account", "fileId", "newName"],
    },
  },
  {
    name: "drive_delete",
    description:
      "Delete a Drive file. By default the file is moved to the trash (reversible — it can be restored). Set permanent=true to delete the file IRREVERSIBLY: the file is removed from Drive entirely, cannot be recovered from the trash, and the action cannot be undone.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
        fileId: {
          type: "string",
          description: "The Drive file ID to delete",
        },
        permanent: {
          type: "boolean",
          description:
            "If true, permanently delete the file (IRREVERSIBLE — bypasses the trash). Default false: move to trash.",
        },
      },
      required: ["account", "fileId"],
    },
  },
  {
    name: "drive_download",
    description:
      "Download a Drive file's actual content to local disk by streaming. Complements drive_read_content (which only handles textual content). For Google native files (Docs/Sheets/Slides) the file is exported: by default Docs and Slides export to PDF and Sheets to .xlsx; override with exportMimeType. Folders, shortcuts and other non-exportable native types return an error.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account alias or email to use",
        },
        fileId: {
          type: "string",
          description: "The Drive file ID to download",
        },
        destPath: {
          type: "string",
          description:
            "Absolute local path (including the filename) where the content will be written. Parent directories are created if missing.",
        },
        exportMimeType: {
          type: "string",
          description:
            "Optional export MIME type. Applies only to Google native files (Docs/Sheets/Slides); ignored for regular files.",
        },
      },
      required: ["account", "fileId", "destPath"],
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
  gmailClient: GmailClient,
  driveClient: DriveClient
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

      case "drive_search": {
        const { account, query, maxResults = 10 } = args as {
          account: string;
          query: string;
          maxResults?: number;
        };
        const client = await driveClient.getClient(account);
        const response = await client.files.list({
          q: query,
          pageSize: maxResults,
          fields: "files(id,name,mimeType,modifiedTime,parents,trashed)",
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data.files, null, 2) },
          ],
        };
      }

      case "drive_get_metadata": {
        const { account, fileId } = args as {
          account: string;
          fileId: string;
        };
        const client = await driveClient.getClient(account);
        const response = await client.files.get({
          fileId,
          fields:
            "id,name,mimeType,size,modifiedTime,createdTime,parents,trashed,owners,webViewLink",
          supportsAllDrives: true,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      }

      case "drive_read_content": {
        const { account, fileId } = args as {
          account: string;
          fileId: string;
        };
        const client = await driveClient.getClient(account);

        // Fetch metadata first to decide how to read the content
        const meta = await client.files.get({
          fileId,
          fields: "id,name,mimeType,size,webViewLink",
          supportsAllDrives: true,
        });
        const mimeType = meta.data.mimeType || "";

        const GOOGLE_EXPORT_MAP: Record<string, string> = {
          "application/vnd.google-apps.document": "text/plain",
          "application/vnd.google-apps.spreadsheet": "text/csv",
          "application/vnd.google-apps.presentation": "text/plain",
        };

        if (mimeType.startsWith("application/vnd.google-apps.")) {
          const exportMime = GOOGLE_EXPORT_MAP[mimeType];
          if (!exportMime) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      note: `MIME type ${mimeType} is a Google native format with no text export mapping. Returning metadata only.`,
                      metadata: meta.data,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
          const exported = await client.files.export(
            { fileId, mimeType: exportMime },
            { responseType: "text" }
          );
          return {
            content: [{ type: "text", text: String(exported.data) }],
          };
        }

        if (mimeType.startsWith("text/") || mimeType === "application/json") {
          const downloaded = await client.files.get(
            { fileId, alt: "media", supportsAllDrives: true },
            { responseType: "text" }
          );
          return {
            content: [{ type: "text", text: String(downloaded.data) }],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  note: "File is binary (not text). Content not downloaded — returning metadata only.",
                  metadata: meta.data,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "drive_create_folder": {
        const { account, name: folderName, parentId } = args as {
          account: string;
          name: string;
          parentId?: string;
        };
        const client = await driveClient.getClient(account);
        const response = await client.files.create({
          requestBody: {
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: parentId ? [parentId] : undefined,
          },
          fields: "id,name,parents,webViewLink",
          supportsAllDrives: true,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      }

      case "drive_upload": {
        const {
          account,
          localPath,
          name: uploadName,
          parentId,
          mimeType,
        } = args as {
          account: string;
          localPath: string;
          name?: string;
          parentId?: string;
          mimeType?: string;
        };
        if (!fs.existsSync(localPath)) {
          return {
            content: [
              {
                type: "text",
                text: `Error: local file not found: ${localPath}`,
              },
            ],
          };
        }
        const client = await driveClient.getClient(account);
        const fileName = uploadName || path.basename(localPath);
        const response = await client.files.create({
          requestBody: {
            name: fileName,
            parents: parentId ? [parentId] : undefined,
          },
          media: {
            mimeType,
            body: fs.createReadStream(localPath),
          },
          fields: "id,name,mimeType,size,parents,webViewLink",
          supportsAllDrives: true,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      }

      case "drive_copy": {
        const { account, fileId, name: copyName, parentId } = args as {
          account: string;
          fileId: string;
          name?: string;
          parentId?: string;
        };
        const client = await driveClient.getClient(account);
        const response = await client.files.copy({
          fileId,
          requestBody: {
            name: copyName,
            parents: parentId ? [parentId] : undefined,
          },
          fields: "id,name,parents,webViewLink",
          supportsAllDrives: true,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      }

      case "drive_move": {
        const { account, fileId, newParentId } = args as {
          account: string;
          fileId: string;
          newParentId: string;
        };
        const client = await driveClient.getClient(account);

        // Get current parents so we can remove them in the same update call
        const meta = await client.files.get({
          fileId,
          fields: "parents",
          supportsAllDrives: true,
        });
        const currentParents = (meta.data.parents || []).join(",");

        const response = await client.files.update({
          fileId,
          addParents: newParentId,
          removeParents: currentParents,
          fields: "id,name,parents,webViewLink",
          supportsAllDrives: true,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      }

      case "drive_rename": {
        const { account, fileId, newName } = args as {
          account: string;
          fileId: string;
          newName: string;
        };
        const client = await driveClient.getClient(account);
        const response = await client.files.update({
          fileId,
          requestBody: { name: newName },
          fields: "id,name,webViewLink",
          supportsAllDrives: true,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      }

      case "drive_delete": {
        const { account, fileId, permanent = false } = args as {
          account: string;
          fileId: string;
          permanent?: boolean;
        };
        const client = await driveClient.getClient(account);

        if (permanent) {
          await client.files.delete({
            fileId,
            supportsAllDrives: true,
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { status: "permanently_deleted", fileId },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const response = await client.files.update({
          fileId,
          requestBody: { trashed: true },
          fields: "id,name,trashed",
          supportsAllDrives: true,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      }

      case "drive_download": {
        const { account, fileId, destPath, exportMimeType } = args as {
          account: string;
          fileId: string;
          destPath: string;
          exportMimeType?: string;
        };
        const client = await driveClient.getClient(account);

        // 1. Inspect the file type
        const meta = await client.files.get({
          fileId,
          fields: "id,name,mimeType,size",
          supportsAllDrives: true,
        });
        const mimeType = meta.data.mimeType || "";

        // 2. Ensure destination directory exists
        fs.mkdirSync(path.dirname(destPath), { recursive: true });

        const GOOGLE_EXPORT_DEFAULTS: Record<string, string> = {
          "application/vnd.google-apps.document": "application/pdf",
          "application/vnd.google-apps.spreadsheet":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.google-apps.presentation": "application/pdf",
        };

        // 3 & 4. Stream from the right endpoint
        const isNative = mimeType.startsWith("application/vnd.google-apps.");
        let streamResponse;
        if (isNative) {
          const exportMime =
            exportMimeType || GOOGLE_EXPORT_DEFAULTS[mimeType];
          if (!exportMime) {
            throw new Error(
              `Cannot download native Google type "${mimeType}": no default export MIME mapping and no exportMimeType provided. Folders, shortcuts and other non-exportable native types are not supported by drive_download.`
            );
          }
          streamResponse = await client.files.export(
            { fileId, mimeType: exportMime },
            { responseType: "stream" }
          );
        } else {
          streamResponse = await client.files.get(
            { fileId, alt: "media", supportsAllDrives: true },
            { responseType: "stream" }
          );
        }

        // 5. Pipe to disk; resolve on writeStream finish, reject on any error
        await new Promise<void>((resolve, reject) => {
          const writeStream = fs.createWriteStream(destPath);
          (streamResponse.data as unknown as NodeJS.ReadableStream)
            .on("error", reject)
            .pipe(writeStream)
            .on("finish", () => resolve())
            .on("error", reject);
        });

        // 6. Summary
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "downloaded",
                  fileId,
                  name: meta.data.name,
                  mimeType,
                  destPath,
                  bytes: fs.statSync(destPath).size,
                },
                null,
                2
              ),
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
