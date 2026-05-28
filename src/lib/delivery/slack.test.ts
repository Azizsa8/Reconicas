import { describe, expect, it } from "vitest";
import { formatForSlack, isSlackUrl, type ReconcartAlertPayload } from "./slack";

describe("isSlackUrl", () => {
  it("detects standard incoming-webhook URLs", () => {
    expect(
      isSlackUrl("https://hooks.slack.com/services/T00/B00/abc123"),
    ).toBe(true);
  });

  it("rejects non-Slack hosts that happen to start with 'slack'", () => {
    expect(isSlackUrl("https://slack.example.com/hook")).toBe(false);
    expect(isSlackUrl("https://example.com/slack/hook")).toBe(false);
  });

  it("rejects n8n, Zapier, Discord URLs", () => {
    expect(isSlackUrl("https://n8n.example.com/webhook/abc")).toBe(false);
    expect(isSlackUrl("https://hooks.zapier.com/hooks/catch/123/abc")).toBe(false);
    expect(
      isSlackUrl("https://discord.com/api/webhooks/1234/abc"),
    ).toBe(false);
  });

  it("returns false for malformed URLs rather than throwing", () => {
    expect(isSlackUrl("not a url")).toBe(false);
    expect(isSlackUrl("")).toBe(false);
  });
});

describe("formatForSlack", () => {
  const fullPayload: ReconcartAlertPayload = {
    alert: {
      label: "Price drops below 30 SAR",
      expression: "price < 30",
      fired_at: "2026-05-28T08:14:11Z",
      explanation: "Current price 28.50 SAR < threshold 30",
    },
    track: {
      url: "https://www.noon.com/saudi-en/.../p/N12345",
      product_name: "Garnier Micellar Cleansing Water",
      brand: "Garnier",
      platform: "noon",
    },
    snapshot: {
      price: 28.5,
      currency: "SAR",
      availability: "in_stock",
    },
  };

  it("produces an object with text fallback and blocks array", () => {
    const out = formatForSlack(fullPayload);
    expect(typeof out.text).toBe("string");
    expect(Array.isArray(out.blocks)).toBe(true);
  });

  it("uses the alert label as the header", () => {
    const out = formatForSlack(fullPayload) as { blocks: Record<string, unknown>[] };
    const header = out.blocks[0] as { type: string; text: { text: string } };
    expect(header.type).toBe("header");
    expect(header.text.text).toBe("Price drops below 30 SAR");
  });

  it("includes price, stock, platform, and rule fields when present", () => {
    const out = formatForSlack(fullPayload) as { blocks: Record<string, unknown>[] };
    const fieldsBlock = out.blocks.find(
      (b) => (b as { type: string }).type === "section" && "fields" in b,
    ) as { fields: { text: string }[] } | undefined;
    expect(fieldsBlock).toBeDefined();
    const allFieldText = fieldsBlock!.fields.map((f) => f.text).join("|");
    expect(allFieldText).toContain("28.5 SAR");
    expect(allFieldText).toContain("in_stock");
    expect(allFieldText).toContain("noon");
    expect(allFieldText).toContain("price < 30");
  });

  it("omits the fields section when no fields apply", () => {
    const sparse: ReconcartAlertPayload = {
      alert: { ...fullPayload.alert, expression: null },
      track: { ...fullPayload.track, platform: null },
      snapshot: { price: null, currency: null, availability: null },
    };
    const out = formatForSlack(sparse) as { blocks: Record<string, unknown>[] };
    const fieldsBlock = out.blocks.find(
      (b) => (b as { type: string }).type === "section" && "fields" in b,
    );
    expect(fieldsBlock).toBeUndefined();
  });

  it("falls back to 'ReconCart alert' when label is null", () => {
    const noLabel: ReconcartAlertPayload = {
      ...fullPayload,
      alert: { ...fullPayload.alert, label: null },
    };
    const out = formatForSlack(noLabel) as {
      text: string;
      blocks: { text?: { text: string } }[];
    };
    expect(out.text.startsWith("ReconCart alert")).toBe(true);
    expect((out.blocks[0] as { text: { text: string } }).text.text).toBe(
      "ReconCart alert",
    );
  });

  it("escapes <, >, & in user-supplied strings to prevent mrkdwn injection", () => {
    const malicious: ReconcartAlertPayload = {
      ...fullPayload,
      alert: {
        ...fullPayload.alert,
        explanation: "Beware <script>alert('xss')</script> & friends",
      },
      track: {
        ...fullPayload.track,
        product_name: "Product <name>",
      },
    };
    const out = formatForSlack(malicious) as { blocks: Record<string, unknown>[] };
    const section = out.blocks[1] as { text: { text: string } };
    expect(section.text.text).toContain("&lt;script&gt;");
    expect(section.text.text).toContain("&amp; friends");
    expect(section.text.text).toContain("Product &lt;name&gt;");
  });

  it("links the product name to the track URL", () => {
    const out = formatForSlack(fullPayload) as { blocks: Record<string, unknown>[] };
    const section = out.blocks[1] as { text: { text: string } };
    expect(section.text.text).toContain(
      `<${fullPayload.track.url}|Garnier Micellar Cleansing Water>`,
    );
  });

  it("uses the URL as the link text when product_name is null", () => {
    const noName: ReconcartAlertPayload = {
      ...fullPayload,
      track: { ...fullPayload.track, product_name: null },
    };
    const out = formatForSlack(noName) as { blocks: Record<string, unknown>[] };
    const section = out.blocks[1] as { text: { text: string } };
    expect(section.text.text).toContain(`<${noName.track.url}|`);
  });
});
