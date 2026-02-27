import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSlackTools } from "../../index";

const { mockCanvasesCreate, mockAuthTest } = vi.hoisted(() => ({
  mockCanvasesCreate: vi.fn(),
  mockAuthTest: vi.fn(),
}));

vi.mock("@slack/web-api", () => ({
  WebClient: function () {
    return {
      canvases: { create: mockCanvasesCreate },
      auth: { test: mockAuthTest },
    };
  },
}));

describe("slack_create_canvas", () => {
  it("is returned by createSlackTools", () => {
    const tools = createSlackTools("xoxb-test-token");
    expect(tools).toHaveProperty("slack_create_canvas");
  });

  it("has description, inputSchema, outputSchema, execute, and toModelOutput", () => {
    const { slack_create_canvas } = createSlackTools("xoxb-test-token");
    expect(typeof slack_create_canvas.description).toBe("string");
    expect(slack_create_canvas).toHaveProperty("inputSchema");
    expect(slack_create_canvas).toHaveProperty("outputSchema");
    expect(typeof slack_create_canvas.execute).toBe("function");
    expect(typeof slack_create_canvas.toModelOutput).toBe("function");
  });

  describe("execute", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockCanvasesCreate.mockResolvedValue({
        ok: true,
        canvas_id: "F0AHGEE769Y",
      });
      mockAuthTest.mockResolvedValue({
        ok: true,
        url: "https://e0931kugujc-zg1ddxk7.slack.com/",
        team_id: "T0926L5D6G3",
      });
    });

    it("calls canvases.create with title and markdown content", async () => {
      const { slack_create_canvas } = createSlackTools("xoxb-test-token");
      await slack_create_canvas.execute!(
        { title: "Meeting Notes", content: "# Agenda\n- Item 1\n- Item 2" },
        { toolCallId: "test", messages: [] },
      );
      expect(mockCanvasesCreate).toHaveBeenCalledWith({
        title: "Meeting Notes",
        document_content: {
          type: "markdown",
          markdown: "# Agenda\n- Item 1\n- Item 2",
        },
      });
    });

    it("returns typed object matching MCP shape", async () => {
      const { slack_create_canvas } = createSlackTools("xoxb-test-token");
      const result = await slack_create_canvas.execute!(
        { title: "Test Canvas", content: "# Hello\nTest content" },
        { toolCallId: "test", messages: [] },
      );
      expect(result).toEqual({
        canvas_id: "F0AHGEE769Y",
        canvas_url:
          "https://e0931kugujc-zg1ddxk7.slack.com/docs/T0926L5D6G3/F0AHGEE769Y",
      });
    });

    it("throws on Slack API error", async () => {
      mockCanvasesCreate.mockRejectedValue(
        new Error("canvas_disabled_user_team"),
      );
      const { slack_create_canvas } = createSlackTools("xoxb-test-token");
      await expect(
        slack_create_canvas.execute!(
          { title: "Test", content: "Content" },
          { toolCallId: "test", messages: [] },
        ),
      ).rejects.toThrow("canvas_disabled_user_team");
    });
  });

  describe("toModelOutput", () => {
    it("returns MCP-compatible JSON text", () => {
      const { slack_create_canvas } = createSlackTools("xoxb-test-token");
      const output = {
        canvas_id: "F0AHGEE769Y",
        canvas_url:
          "https://e0931kugujc-zg1ddxk7.slack.com/docs/T0926L5D6G3/F0AHGEE769Y",
      };
      const modelOutput = slack_create_canvas.toModelOutput!({
        toolCallId: "test",
        input: { title: "Test", content: "# Hello" },
        output,
      });
      expect(modelOutput).toEqual({
        type: "text",
        value: JSON.stringify(output),
      });
    });
  });
});
