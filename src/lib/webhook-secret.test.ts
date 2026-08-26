import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-123";

async function loadModule() {
  return import("./webhook-secret");
}

function makeRequest(header: string, value: string, body: string): Request {
  const headers = new Headers({ [header]: value });
  return new Request("http://localhost/api/webhook", {
    method: "POST",
    headers,
    body,
  });
}

describe("verifyWebhookSignature", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.WEBHOOK_SECRET;
  });

  it("sin secret configurado permite todo (dev mode)", async () => {
    const { verifyWebhookSignature } = await loadModule();
    const req = makeRequest("x-webhook-secret", "anything", "{}");
    expect(await verifyWebhookSignature(req)).toBe(true);
  });

  it("valida header en claro correcto", async () => {
    process.env.WEBHOOK_SECRET = SECRET;
    const { verifyWebhookSignature } = await loadModule();
    const req = makeRequest("x-webhook-secret", SECRET, "{}");
    expect(await verifyWebhookSignature(req)).toBe(true);
  });

  it("rechaza header en claro incorrecto", async () => {
    process.env.WEBHOOK_SECRET = SECRET;
    const { verifyWebhookSignature } = await loadModule();
    const req = makeRequest("x-webhook-secret", "wrong", "{}");
    expect(await verifyWebhookSignature(req)).toBe(false);
  });

  it("valida firma HMAC-SHA256 del body (x-hub-signature-256)", async () => {
    process.env.WEBHOOK_SECRET = SECRET;
    const { verifyWebhookSignature } = await loadModule();
    const body = JSON.stringify({ event: "messages.upsert", instance: "x" });
    const digest = createHmac("sha256", SECRET).update(body).digest("hex");
    const req = makeRequest("x-hub-signature-256", `sha256=${digest}`, body);
    expect(await verifyWebhookSignature(req)).toBe(true);
  });

  it("rechaza firma HMAC incorrecta", async () => {
    process.env.WEBHOOK_SECRET = SECRET;
    const { verifyWebhookSignature } = await loadModule();
    const body = JSON.stringify({ event: "messages.upsert", instance: "x" });
    const req = makeRequest("x-hub-signature-256", `sha256=${"0".repeat(64)}`, body);
    expect(await verifyWebhookSignature(req)).toBe(false);
  });

  it("rechaza request sin firma", async () => {
    process.env.WEBHOOK_SECRET = SECRET;
    const { verifyWebhookSignature } = await loadModule();
    const req = new Request("http://localhost/api/webhook", { method: "POST", body: "{}" });
    expect(await verifyWebhookSignature(req)).toBe(false);
  });
});