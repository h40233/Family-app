import { jsonData } from "@/lib/api-response";
import { apiRouteError } from "@/server/auth";
import { handleBillingWebhook } from "@/server/plans";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const event = await handleBillingWebhook({
      rawBody,
      signature: request.headers.get("x-family-os-billing-signature")
    });

    return jsonData(event);
  } catch (error) {
    return apiRouteError(error);
  }
}
