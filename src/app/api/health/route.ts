import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

interface HealthCheck {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: CheckResult;
    supabase: CheckResult;
    evolutionApi: CheckResult;
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
    const supabase = await createServerClient();
    const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
    if (error) return { status: "error", latencyMs: Date.now() - start, error: error.message };
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return { status: "error", latencyMs: Date.now() - start, error: String(err) };
  }
}

async function checkSupabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${supabaseConfig.url}/rest/v1/`, {
      method: "HEAD",
      headers: { apikey: supabaseConfig.anonKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { status: "error", latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return { status: "error", latencyMs: Date.now() - start, error: String(err) };
  }
}

async function checkEvolutionApi(): Promise<CheckResult> {
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  if (!evolutionUrl) return { status: "ok", latencyMs: 0, error: "Not configured (skipped)" };

  const start = Date.now();
  try {
    const res = await fetch(`${evolutionUrl}/`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    // Evolution API may return various codes, any response means it's up
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return { status: "error", latencyMs: Date.now() - start, error: String(err) };
  }
}

export async function GET() {
  const [database, supabase, evolutionApi] = await Promise.all([
    checkDatabase(),
    checkSupabase(),
    checkEvolutionApi(),
  ]);

  const allOk = database.status === "ok" && supabase.status === "ok" && evolutionApi.status === "ok";
  const anyError = database.status === "error" || supabase.status === "error";

  const health: HealthCheck = {
    status: allOk ? "ok" : anyError ? "error" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || "0.1.0",
    checks: { database, supabase, evolutionApi },
  };

  const httpStatus = health.status === "error" ? 503 : 200;

  return NextResponse.json(health, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
