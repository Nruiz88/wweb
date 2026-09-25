import { NextResponse } from "next/server";
import { getPublicPlans } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * Endpoint público de precios (sin auth) para la landing.
 * Devuelve plan_config + precio del bot extra, en pesos enteros.
 */
export async function GET() {
  const data = await getPublicPlans();
  return NextResponse.json({ status: "success", data });
}
