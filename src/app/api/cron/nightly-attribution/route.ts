import { NextRequest, NextResponse } from "next/server";

import {
  runNightlyAttributionForAllProjects,
  runNightlyAttributionForProject,
} from "@/lib/attribution/nightly-run";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetDate = request.nextUrl.searchParams.get("date") ?? undefined;
  const projectId = request.nextUrl.searchParams.get("projectId") ?? undefined;

  try {
    if (projectId) {
      const result = await runNightlyAttributionForProject(projectId, targetDate);
      return NextResponse.json(result);
    }

    const summary = await runNightlyAttributionForAllProjects(targetDate);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[cron/nightly-attribution]", error);
    return NextResponse.json(
      { error: "Nightly attribution run failed" },
      { status: 500 }
    );
  }
}
