import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSlackTools } from "../../index";

const { mockChatDelete } = vi.hoisted(() => ({
  mockChatDelete: vi.fn(),
}));

vi.mock("@slack/web-api", () => ({
  WebClient: function () {
    return {
      chat: {
        delete: mockChatDelete,
      },
    };
  },
}));

describe("slack_delete_message", () => {
  it("is returned by createSlackTools", () => {
    const tools = createSlackTools("xoxb-test-token");
    expect(tools).toHaveProperty("slack_delete_message");
  });

  it("has description, inputSchema, outputSchema, execute, and toModelOutput", () => {
    const { slack_delete_message } = createSlackTools("xoxb-test-token");
    expect(typeof slack_delete_message.description).toBe("string");
    expect(slack_delete_message).toHaveProperty("inputSchema");
    expect(slack_delete_message).toHaveProperty("outputSchema");
    expect(typeof slack_delete_message.execute).toBe("function");
    expect(typeof slack_delete_message.toModelOutput).toBe("function");
  });

  describe("execute", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockChatDelete.mockResolvedValue({
        ok: true,
        channel: "C09T3M2NLG4",
        ts: "1772159936.361869",
      });
    });

    it("calls chat.delete with channel and ts", async () => {
      const { slack_delete_message } = createSlackTools("xoxb-test-token");
      await slack_delete_message.execute!(
        { channel_id: "C09T3M2NLG4", message_ts: "1772159936.361869" },
        { toolCallId: "test", messages: [] },
      );
      expect(mockChatDelete).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "C09T3M2NLG4",
          ts: "1772159936.361869",
        }),
      );
    });

    it("returns typed object with ok, channel_id, and deleted_ts", async () => {
      const { slack_delete_message } = createSlackTools("xoxb-test-token");
      const result = await slack_delete_message.execute!(
        { channel_id: "C09T3M2NLG4", message_ts: "1772159936.361869" },
        { toolCallId: "test", messages: [] },
      );
      expect(result).toEqual({
        ok: true,
        channel_id: "C09T3M2NLG4",
        deleted_ts: "1772159936.361869",
      });
    });

    it("throws on Slack API error", async () => {
      mockChatDelete.mockRejectedValue(new Error("message_not_found"));
      const { slack_delete_message } = createSlackTools("xoxb-test-token");
      await expect(
        slack_delete_message.execute!(
          { channel_id: "C09T3M2NLG4", message_ts: "0000000000.000000" },
          { toolCallId: "test", messages: [] },
        ),
      ).rejects.toThrow("message_not_found");
    });

    it("throws when bot cannot delete another user's message", async () => {
      mockChatDelete.mockRejectedValue(new Error("cant_delete_message"));
      const { slack_delete_message } = createSlackTools("xoxb-test-token");
      await expect(
        slack_delete_message.execute!(
          { channel_id: "C09T3M2NLG4", message_ts: "1772159936.361869" },
          { toolCallId: "test", messages: [] },
        ),
      ).rejects.toThrow("cant_delete_message");
    });
  });

  describe("toModelOutput", () => {
    it("returns JSON text", () => {
      const { slack_delete_message } = createSlackTools("xoxb-test-token");
      const output = {
        ok: true,
        channel_id: "C09T3M2NLG4",
        deleted_ts: "1772159936.361869",
      };
      const modelOutput = slack_delete_message.toModelOutput!({
        toolCallId: "test",
        input: {
          channel_id: "C09T3M2NLG4",
          message_ts: "1772159936.361869",
        },
        output,
      });
      expect(modelOutput).toEqual({
        type: "text",
        value: JSON.stringify(output),
      });
    });
  });
});
