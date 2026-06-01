// OpenAPI 3.1 description of the public /api/v1/* surface. Served as a
// route handler (rather than a static JSON file) so the server URL can be
// computed from NEXT_PUBLIC_SITE_URL without a build-time substitution.
//
// Generate clients from this with: openapi-typescript, openapi-generator,
// orval, hey-api, etc. Keep this in sync with the actual route handlers
// when you add or change endpoints.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const server = (process.env.NEXT_PUBLIC_SITE_URL || "https://reconcart.vercel.app").trim().replace(/\/+$/, "");
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "ReconCart API",
      version: "1.0.0",
      description:
        "Competitive-intelligence API. Authenticate with an API key " +
        "(Authorization: Bearer rc_live_…) or a browser session cookie.",
      contact: { email: "developers@reconcart.com" },
    },
    servers: [{ url: server }],
    components: {
      securitySchemes: {
        BearerApiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "rc_live_<43_base64url_chars>",
          description: "ReconCart API key issued via Settings → API keys.",
        },
        SessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "sb-<project_ref>-auth-token",
          description: "Set automatically by /login (browser only).",
        },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["ok", "error"],
          properties: {
            ok: { type: "boolean", const: false },
            error: { type: "string" },
          },
        },
        Track: {
          type: "object",
          required: ["id", "url", "cadence", "enabled", "created_at"],
          properties: {
            id: { type: "integer", format: "int64" },
            url: { type: "string", format: "uri" },
            intent: { type: ["string", "null"] },
            cadence: { type: "string", enum: ["hourly", "daily", "weekly", "ondemand"] },
            enabled: { type: "boolean" },
            last_run_at: { type: ["string", "null"], format: "date-time" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Alert: {
          type: "object",
          required: ["id", "fired_at", "acknowledged", "explanation"],
          properties: {
            id: { type: "integer", format: "int64" },
            fired_at: { type: "string", format: "date-time" },
            acknowledged: { type: "boolean" },
            explanation: { type: "string" },
            condition: {
              type: "object",
              properties: {
                id: { type: "integer" },
                expression: { type: "string" },
                label: { type: ["string", "null"] },
              },
            },
            track: {
              type: "object",
              properties: {
                id: { type: "integer" },
                url: { type: "string", format: "uri" },
              },
            },
          },
        },
        Channel: {
          type: "object",
          required: ["id", "kind", "target", "enabled", "created_at"],
          properties: {
            id: { type: "integer" },
            kind: { type: "string", enum: ["webhook", "email", "console"] },
            target: { type: "string" },
            label: { type: ["string", "null"] },
            enabled: { type: "boolean" },
            config: {
              type: "object",
              properties: {
                signing_secret_present: { type: "boolean" },
                rate_limit: {
                  type: "object",
                  properties: {
                    max: { type: "integer" },
                    window_seconds: { type: "integer" },
                  },
                },
                alert_filter: {
                  type: "object",
                  properties: {
                    condition_ids: { type: "array", items: { type: "integer" } },
                    only_when: { type: "string", enum: ["any", "in_stock", "out_of_stock"] },
                  },
                },
              },
            },
            created_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
    security: [{ BearerApiKey: [] }, { SessionCookie: [] }],
    paths: {
      "/api/health": {
        get: {
          summary: "Health check",
          description: "Public. Returns 200 if app + DB healthy, 503 otherwise.",
          security: [],
          responses: {
            200: { description: "Healthy" },
            503: { description: "Unhealthy" },
          },
        },
      },
      "/api/v1/tracks": {
        get: {
          summary: "List tracks",
          responses: {
            200: {
              description: "List of tracks in the workspace",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      tenant_id: { type: "string", format: "uuid" },
                      count: { type: "integer" },
                      tracks: { type: "array", items: { $ref: "#/components/schemas/Track" } },
                    },
                  },
                },
              },
            },
            401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          summary: "Create track",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: {
                    url: { type: "string", format: "uri" },
                    intent: { type: "string" },
                    cadence: { type: "string", enum: ["hourly", "daily", "weekly", "ondemand"], default: "hourly" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Created", content: { "application/json": { schema: {
              type: "object",
              properties: {
                ok: { type: "boolean" },
                tenant_id: { type: "string", format: "uuid" },
                track: { $ref: "#/components/schemas/Track" },
                initial_scrape: { type: ["object", "null"] },
              },
            } } } },
            400: { description: "Bad request" },
            401: { description: "Unauthorized" },
            409: { description: "Already tracking this URL (canonical dedup)" },
          },
        },
      },
      "/api/v1/tracks/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        get: { summary: "Track detail + recent scrapes + conditions", responses: { 200: { description: "OK" }, 401: { description: "Unauthorized" }, 404: { description: "Not found" } } },
        patch: {
          summary: "Update track (partial)",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    cadence: { type: "string", enum: ["hourly", "daily", "weekly", "ondemand"] },
                    enabled: { type: "boolean" },
                    intent: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Updated" }, 401: {}, 404: {} },
        },
        delete: {
          summary: "Delete track (cascade)",
          responses: { 200: { description: "Deleted" }, 401: {}, 404: {} },
        },
      },
      "/api/v1/tracks/{id}/run": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        post: {
          summary: "Run track now",
          description: "Triggers an on-demand scrape. Per-track 10s lock; returns 429 if concurrent.",
          responses: { 200: {}, 401: {}, 404: {}, 429: { description: "Run in progress" } },
        },
      },
      "/api/v1/alerts": {
        get: {
          summary: "List alerts",
          parameters: [
            { name: "acknowledged", in: "query", schema: { type: "boolean" } },
            { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 500 } },
          ],
          responses: { 200: { description: "List of alerts", content: { "application/json": { schema: {
            type: "object",
            properties: {
              ok: { type: "boolean" },
              tenant_id: { type: "string", format: "uuid" },
              count: { type: "integer" },
              alerts: { type: "array", items: { $ref: "#/components/schemas/Alert" } },
            },
          } } } } },
        },
      },
      "/api/v1/alerts/{id}/ack": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        post: {
          summary: "Acknowledge (or reopen) an alert",
          requestBody: {
            content: {
              "application/json": {
                schema: { type: "object", properties: { acknowledged: { type: "boolean", default: true } } },
              },
            },
          },
          responses: { 200: {}, 401: {}, 404: {} },
        },
      },
      "/api/v1/channels": {
        get: { summary: "List channels", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { channels: { type: "array", items: { $ref: "#/components/schemas/Channel" } } } } } } } } },
        post: {
          summary: "Create channel",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["kind", "target"],
                  properties: {
                    kind: { type: "string", enum: ["webhook", "email", "console"] },
                    target: { type: "string" },
                    label: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Created. signing_secret returned ONCE for webhook." } },
        },
      },
      "/api/v1/channels/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        delete: { summary: "Delete channel (cascade)", responses: { 200: {}, 401: {}, 404: {} } },
      },
      "/api/scrape": {
        post: {
          summary: "Preview-scrape a URL (no persistence)",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["url"], properties: { url: { type: "string", format: "uri" } } } } } },
          responses: { 200: { description: "ScrapeRecord" }, 401: {} },
        },
      },
      "/api/intent": {
        post: {
          summary: "Translate natural language to condition DSL",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["text"], properties: { text: { type: "string" } } } } } },
          responses: { 200: { description: "IntentResult" }, 401: {} },
        },
      },
    },
  };
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
