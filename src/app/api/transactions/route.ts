import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getTransactions } from "@/lib/attribution/repository";
import { defaultRange } from "@/lib/attribution/date-range";
import { apiErrorResponse } from "@/lib/auth/errors";

const querySchema = z
  .object({
    projectId: z.string().uuid(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    search: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["purchase_revenue", "event_timestamp"]).default("event_timestamp"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    channelDimension: z.enum(["source", "medium", "campaign"]).optional(),
    channelValue: z.string().trim().min(1).optional(),
  })
  .refine((data) => Boolean(data.channelDimension) === Boolean(data.channelValue), {
    message: "channelDimension and channelValue must be provided together",
  });

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { projectId } = parsed.data;
  const fallback = defaultRange();
  const {
    from = fallback.from,
    to = fallback.to,
    search,
    page,
    pageSize,
    sortBy,
    sortDir,
    channelDimension,
    channelValue,
  } = parsed.data;

  try {
    const { rows, total } = await getTransactions(projectId, {
      from,
      to,
      search,
      page,
      pageSize,
      sortBy,
      sortDir,
      channel: channelDimension && channelValue ? { dimension: channelDimension, value: channelValue } : undefined,
    });

    return NextResponse.json({ rows, total, page, pageSize });
  } catch (error) {
    return apiErrorResponse(error, "[api/transactions]", "Failed to load transactions");
  }
}
