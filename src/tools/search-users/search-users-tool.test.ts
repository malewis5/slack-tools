import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSlackTools } from "../../index";

const { mockUsersList, mockAuthTest } = vi.hoisted(() => ({
  mockUsersList: vi.fn(),
  mockAuthTest: vi.fn(),
}));

vi.mock("@slack/web-api", () => ({
  WebClient: function () {
    return {
      users: { list: mockUsersList },
      auth: { test: mockAuthTest },
    };
  },
}));

describe("slack_search_users", () => {
  it("is returned by createSlackTools", () => {
    const tools = createSlackTools("xoxb-test-token");
    expect(tools).toHaveProperty("slack_search_users");
  });

  it("has description, inputSchema, outputSchema, execute, and toModelOutput", () => {
    const { slack_search_users } = createSlackTools("xoxb-test-token");
    expect(typeof slack_search_users.description).toBe("string");
    expect(slack_search_users).toHaveProperty("inputSchema");
    expect(slack_search_users).toHaveProperty("outputSchema");
    expect(typeof slack_search_users.execute).toBe("function");
    expect(typeof slack_search_users.toModelOutput).toBe("function");
  });

  describe("execute", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockAuthTest.mockResolvedValue({
        ok: true,
        url: "https://e0931kugujc-zg1ddxk7.slack.com/",
      });
      mockUsersList.mockResolvedValue({
        ok: true,
        members: [
          {
            id: "U0931KUHGC8",
            name: "sd091yk2eaet_user",
            real_name: "Matt Lewis",
            profile: {
              email: "matt.lewis@vercel.com",
              title: "",
              image_512: "https://secure.gravatar.com/avatar/abc.jpg?s=512",
            },
            tz: "America/New_York",
            deleted: false,
            is_bot: false,
          },
        ],
        response_metadata: { next_cursor: "" },
      });
    });

    it("calls users.list", async () => {
      const { slack_search_users } = createSlackTools("xoxb-test-token");
      await slack_search_users.execute!(
        { query: "matt" },
        { toolCallId: "test", messages: [] },
      );
      expect(mockUsersList).toHaveBeenCalled();
    });

    it("returns typed object with matched users", async () => {
      const { slack_search_users } = createSlackTools("xoxb-test-token");
      const result = await slack_search_users.execute!(
        { query: "matt" },
        { toolCallId: "test", messages: [] },
      );
      expect(result.query).toBe("matt");
      expect(result.users).toHaveLength(1);
      expect(result.users[0]).toEqual({
        user_id: "U0931KUHGC8",
        name: "Matt Lewis",
        title: "",
        email: "matt.lewis@vercel.com",
        timezone: "America/New_York",
        profile_pic: "https://secure.gravatar.com/avatar/abc.jpg?s=512",
        permalink: "https://e0931kugujc-zg1ddxk7.slack.com/team/U0931KUHGC8",
      });
    });

    it("returns empty when no match", async () => {
      const { slack_search_users } = createSlackTools("xoxb-test-token");
      const result = await slack_search_users.execute!(
        { query: "nonexistent" },
        { toolCallId: "test", messages: [] },
      );
      expect(result.users).toEqual([]);
    });

    it("throws on Slack API error", async () => {
      mockUsersList.mockRejectedValue(new Error("not_authed"));
      const { slack_search_users } = createSlackTools("xoxb-test-token");
      await expect(
        slack_search_users.execute!(
          { query: "test" },
          { toolCallId: "test", messages: [] },
        ),
      ).rejects.toThrow("not_authed");
    });
  });

  describe("toModelOutput", () => {
    it("returns MCP-compatible formatted text", () => {
      const { slack_search_users } = createSlackTools("xoxb-test-token");
      const output = {
        query: "matt",
        users: [
          {
            user_id: "U0931KUHGC8",
            name: "Matt Lewis",
            title: "",
            email: "matt.lewis@vercel.com",
            timezone: "America/New_York",
            profile_pic: "https://gravatar.com/avatar/abc.jpg",
            permalink: "https://e0931kugujc-zg1ddxk7.slack.com/team/U0931KUHGC8",
          },
        ],
        has_more: false,
        next_cursor: undefined,
      };
      const modelOutput = slack_search_users.toModelOutput!({
        toolCallId: "test",
        input: { query: "matt" },
        output,
      });
      const parsed = JSON.parse((modelOutput as { value: string }).value);
      expect(parsed.results).toContain("# Search Results for: matt");
      expect(parsed.results).toContain("## Users (1 results)");
      expect(parsed.results).toContain("Name: Matt Lewis");
      expect(parsed.results).toContain("User ID: U0931KUHGC8");
      expect(parsed).toHaveProperty("pagination_info");
    });
  });
});
