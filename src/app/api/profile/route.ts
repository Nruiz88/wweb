import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { safeErrorMessage, verifyUserAccess } from "@/lib/api-helpers";
import { sanitizeString } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET: Get current user's profile
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lite = searchParams.get("lite") === "1";
  const includeUpcoming = searchParams.get("include") === "upcoming";
  if (lite) {
    const subs = await query<{ plan_type: string; status: string }>(
      "SELECT plan_type, status FROM subscriptions WHERE user_id = ? LIMIT 1",
      [session.userId]
    );
    const sub = subs?.[0];
    return NextResponse.json({
      status: "success",
      data: {
        subscription: sub ? { plan_type: sub.plan_type, status: sub.status } : { plan_type: "starter", status: "active" },
      },
    });
  }

  const profile = await query<{ id: string; email: string; full_name: string; role: string; business_name: string | null; phone: string | null; address: string | null; created_at: string }>(
    "SELECT id, email, full_name, role, business_name, phone, address, created_at FROM profiles WHERE id = ?",
    [session.userId]
  );
  if (!profile.length) {
    return NextResponse.json({ status: "error", error: "User not found" }, { status: 404 });
  }
  const profileData = profile[0];

  const subs = await query<{ plan_type: string; status: string; max_instances: number; updated_at: string }>(
    "SELECT plan_type, status, max_instances, updated_at FROM subscriptions WHERE user_id = ? LIMIT 1",
    [session.userId]
  );
  const sub = subs?.[0];

  const used = await query<{ id: string }>(
    "SELECT id FROM user_instances WHERE user_id = ?",
    [session.userId]
  );
  const usedInstances = used.length;

  let addonCount = 0;
  const addons = await query<{ id: string }>(
    "SELECT id FROM instance_addons WHERE user_id = ? AND status = 'active'",
    [session.userId]
  );
  addonCount = addons.length;

  let upcoming: Array<{ date: string; time: string; name: string | null }> = [];
  if (includeUpcoming) {
    const own = await query<{ id: string }>(
      "SELECT id FROM instances WHERE admin_id = ?",
      [session.userId]
    );
    const ownIds = own.map((i) => i.id);
    const assigned = await query<{ instance_id: string }>(
      "SELECT instance_id FROM user_instances WHERE user_id = ?",
      [session.userId]
    );
    const assignIds = assigned.map((a) => a.instance_id);
    const ids = [...ownIds, ...assignIds];
    if (ids.length > 0) {
      const now = new Date();
      const from = now.toISOString().slice(0, 10);
      const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const appts = await query<{ status: string; appointment_date: string; appointment_time: string; customer_name: string | null }>(
        "SELECT status, appointment_date, appointment_time, customer_name FROM appointments WHERE instance_id IN (" + ids.map(() => "?").join(", ") + ") AND appointment_date >= ? AND appointment_date <= ? AND status IN ('pending','confirmed') ORDER BY appointment_date ASC, appointment_time ASC LIMIT 25",
        [...ids, from, to]
      );
      upcoming = (appts || []).map((a) => ({ date: a.appointment_date, time: a.appointment_time, name: a.customer_name || null })).slice(0, 5);
    }
  }

  return NextResponse.json({
    status: "success",
    data: {
      ...profileData,
      subscription: sub ? {
        plan_type: sub.plan_type,
        status: sub.status,
        max_instances: sub.max_instances,
        used_instances: usedInstances,
        addons: addonCount,
        updated_at: sub.updated_at,
      } : {
        plan_type: "starter",
        status: "active",
        max_instances: 1,
        used_instances: usedInstances,
        addons: 0,
        updated_at: null,
      },
      ...(includeUpcoming ? { upcoming } : {}),
    },
  });
}

// PUT: Update current user's profile
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { full_name, business_name, phone, address } = body as { full_name?: string; business_name?: string; phone?: string; address?: string };

  const { insertId } = await query(
    "UPDATE profiles SET full_name = ?, business_name = ?, phone = ?, address = ? WHERE id = ?",
    [sanitizeString(full_name, 200), sanitizeString(business_name, 200), sanitizeString(phone, 20), sanitizeString(address, 500), session.userId]
  );

  return NextResponse.json({ status: "success", data: { id: session.userId } });
}
