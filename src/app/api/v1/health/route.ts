import { jsonData } from "@/lib/api-response";

export async function GET() {
  return jsonData({
    status: "ok",
    service: "family-os",
    version: "0.1.0"
  });
}
