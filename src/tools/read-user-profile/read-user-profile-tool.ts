import { tool } from "ai";
import { z } from "zod";
import { type WebClient } from "@slack/web-api";

const readUserProfileDescription =
  "Retrieves detailed profile information for a Slack user.\n\nThis tool fetches comprehensive user profile data including contact information, status, timezone, organization name, and role information. It does NOT modify user profiles or send messages - it only reads existing user information.\n";

const readUserProfileInputSchema = z.object({
  user_id: z
    .string()
    .optional()
    .describe(
      "Slack user ID to look up (e.g., 'U0ABC12345'). Defaults to current user if not provided",
    ),
  include_locale: z
    .boolean()
    .optional()
    .describe("Include user's locale information. Default: false"),
  response_format: z
    .string()
    .optional()
    .describe(
      "Level of detail in response. 'detailed' includes all fields, 'concise' shows essential info. Default: 'detailed'",
    ),
});

const readUserProfileOutputSchema = z.object({
  user_id: z.string(),
  username: z.string(),
  display_name: z.string(),
  real_name: z.string(),
  title: z.string(),
  email: z.string(),
  organization_name: z.string(),
  phone: z.string(),
  status: z.string(),
  timezone: z.string(),
  is_admin: z.boolean(),
  is_owner: z.boolean(),
  is_bot: z.boolean(),
  is_restricted: z.boolean(),
});

export function createReadUserProfileTool(client: WebClient) {
  return tool({
    description: readUserProfileDescription,
    inputSchema: readUserProfileInputSchema,
    outputSchema: readUserProfileOutputSchema,
    execute: async (args) => {
      let userId = args.user_id;
      if (!userId) {
        const auth = await client.auth.test();
        userId = auth.user_id!;
      }
      const result = await client.users.info({
        user: userId,
        include_locale: args.include_locale,
      });

      const u = result.user!;
      const enterpriseUser = u as {
        enterprise_user?: { enterprise_name?: string };
      };

      return {
        user_id: u.id ?? "",
        username: u.name ?? "",
        display_name: u.profile?.display_name ?? "",
        real_name: u.real_name ?? "",
        title: u.profile?.title ?? "",
        email: u.profile?.email ?? "",
        organization_name:
          enterpriseUser.enterprise_user?.enterprise_name ?? "",
        phone: u.profile?.phone ?? "",
        status: `${u.profile?.status_emoji ?? ""} ${u.profile?.status_text ?? ""}`,
        timezone: u.tz ?? "",
        is_admin: u.is_admin ?? false,
        is_owner: u.is_owner ?? false,
        is_bot: u.is_bot ?? false,
        is_restricted: u.is_restricted ?? false,
      };
    },
    toModelOutput: ({ output }) => {
      const lines = [
        `User ID: ${output.user_id}`,
        `Username: ${output.username}`,
        `Display Name: ${output.display_name}`,
        `Real Name: ${output.real_name}`,
        `Title: ${output.title}`,
        `Email: ${output.email}`,
        `Organization Name: ${output.organization_name}`,
        `Phone: ${output.phone}`,
        `Status: ${output.status}`,
        `Timezone: ${output.timezone}`,
        `Admin: ${output.is_admin ? "Yes" : "No"}`,
        `Owner: ${output.is_owner ? "Yes" : "No"}`,
        `Bot: ${output.is_bot ? "Yes" : "No"}`,
        `Restricted: ${output.is_restricted ? "Yes" : "No"}`,
        "",
      ];
      return {
        type: "text" as const,
        value: JSON.stringify({ result: lines.join("\n") }),
      };
    },
  });
}
