import { NextResponse } from "next/server";
import { query } from "../../../lib/db";

export const dynamic = "force-dynamic";

interface HealthCheck {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: CheckResult;
  };
}

interface CheckResult {
  status: "ok" | "error";
  latencyMs?: number;
  error?: string;
}

const startTime = Date.now();

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const rows = await query("SELECT 1 AS ok");
    if (rows.length === 0 || rows[0].ok !== 1) {
      return { status: "error", latencyMs: Date.now() - start, error: "Query returned no rows" };
    }
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return { status: "error", latencyMs: Date.now() - start, error: String(err) };
  }
}

export async function GET() {
  const database = await checkDatabase();

  const allOk = database.status === "ok";

  const health: HealthCheck = {
    status: allOk ? "ok" : "error",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || "0.1.0",
    checks: { database },
  };

  const httpStatus = health.status === "error" ? 503 : 200;

  return NextResponse.json(health, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
