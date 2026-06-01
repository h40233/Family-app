import { apiRouteError, requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/permissions";
import { assertReportExportAllowed } from "@/server/plans";
import { exportReports } from "@/server/reports";
import type { ReportExportFormat } from "@/server/reports";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    const format = readFormat(request);

    await assertPermission({
      userId: user.id,
      familyId,
      resourceType: "report",
      action: "export"
    });
    await assertReportExportAllowed(familyId);

    const body = await exportReports({ familyId, userId: user.id, format });

    return new Response(body, {
      headers: {
        "content-disposition": `attachment; filename="family-os-report.${format}"`,
        "content-type":
          format === "xls"
            ? "application/vnd.ms-excel; charset=utf-8"
            : "text/csv; charset=utf-8"
      }
    });
  } catch (error) {
    return apiRouteError(error);
  }
}

function readFormat(request: Request): ReportExportFormat {
  const format = new URL(request.url).searchParams.get("format") ?? "csv";

  if (format !== "csv" && format !== "xls") {
    throw new Error("Only CSV and Excel exports are available in the MVP.");
  }

  return format;
}
