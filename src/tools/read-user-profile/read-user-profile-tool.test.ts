import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSlackTools } from "../../index";

const { mockUsersInfo } = vi.hoisted(() => ({
  mockUsersInfo: vi.fn(),
}));

vi.mock("@slack/web-api", () => ({
  WebClient: function () {
    return {
      users: { info: mockUsersInfo },
    };
  },
}));

describe("slack_read_user_profile", () => {
  it("is returned by createSlackTools", () => {
    const tools = createSlackTools("xoxb-test-token");
    expect(tools).toHaveProperty("slack_read_user_profile");
  });

  it("has description, inputSchema, outputSchema, execute, and toModelOutput", () => {
    const { slack_read_user_profile } = createSlackTools("xoxb-test-token");
    expect(typeof slack_read_user_profile.description).toBe("string");
    expect(slack_read_user_profile).toHaveProperty("inputSchema");
    expect(slack_read_user_profile).toHaveProperty("outputSchema");
    expect(typeof slack_read_user_profile.execute).toBe("function");
    expect(typeof slack_read_user_profile.toModelOutput).toBe("function");
  });

  describe("execute", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockUsersInfo.mockResolvedValue({
        ok: true,
        user: {
          id: "U0931KUHGC8",
          name: "sd091yk2eaet_user",
          real_name: "Matt Lewis",
          profile: {
            display_name: "",
            email: "matt.lewis@vercel.com",
            title: "",
            status_text: "",
            status_emoji: "",
            phone: "",
          },
          tz: "America/New_York",
          is_admin: true,
          is_owner: true,
          is_bot: false,
          is_restricted: false,
          enterprise_user: {
            enterprise_name: "Vercel Slack Agents",
          },
        },
      });
    });

    it("calls users.info with user_id", async () => {
      const { slack_read_user_profile } = createSlackTools("xoxb-test-token");
      await slack_read_user_profile.execute!(
        { user_id: "U0931KUHGC8" },
        { toolCallId: "test", messages: [] },
      );
      expect(mockUsersInfo).toHaveBeenCalledWith(
        expect.objectContaining({ user: "U0931KUHGC8" }),
      );
    });

    it("returns typed object matching MCP shape", async () => {
      const { slack_read_user_profile } = createSlackTools("xoxb-test-token");
      const result = await slack_read_user_profile.execute!(
        { user_id: "U0931KUHGC8" },
        { toolCallId: "test", messages: [] },
      );
      expect(result).toEqual({
        user_id: "U0931KUHGC8",
        username: "sd091yk2eaet_user",
        display_name: "",
        real_name: "Matt Lewis",
        title: "",
        email: "matt.lewis@vercel.com",
        organization_name: "Vercel Slack Agents",
        phone: "",
        status: " ",
        timezone: "America/New_York",
        is_admin: true,
        is_owner: true,
        is_bot: false,
        is_restricted: false,
      });
    });

    it("throws on Slack API error", async () => {
      mockUsersInfo.mockRejectedValue(new Error("user_not_found"));
      const { slack_read_user_profile } = createSlackTools("xoxb-test-token");
      await expect(
        slack_read_user_profile.execute!(
          { user_id: "INVALID" },
          { toolCallId: "test", messages: [] },
        ),
      ).rejects.toThrow("user_not_found");
    });
  });

  describe("toModelOutput", () => {
    it("returns MCP-compatible result text", () => {
      const { slack_read_user_profile } = createSlackTools("xoxb-test-token");
      const output = {
        user_id: "U0931KUHGC8",
        username: "sd091yk2eaet_user",
        display_name: "",
        real_name: "Matt Lewis",
        title: "",
        email: "matt.lewis@vercel.com",
        organization_name: "Vercel Slack Agents",
        phone: "",
        status: " ",
        timezone: "America/New_York",
        is_admin: true,
        is_owner: true,
        is_bot: false,
        is_restricted: false,
      };
      const modelOutput = slack_read_user_profile.toModelOutput!({
        toolCallId: "test",
        input: { user_id: "U0931KUHGC8" },
        output,
      });
      expect(modelOutput).toEqual({
        type: "text",
        value: JSON.stringify({
          result:
            "User ID: U0931KUHGC8\nUsername: sd091yk2eaet_user\nDisplay Name: \nReal Name: Matt Lewis\nTitle: \nEmail: matt.lewis@vercel.com\nOrganization Name: Vercel Slack Agents\nPhone: \nStatus:  \nTimezone: America/New_York\nAdmin: Yes\nOwner: Yes\nBot: No\nRestricted: No\n",
        }),
      });
    });
  });
});
