import { jsonData } from "@/lib/api-response";
import {
  apiRouteError,
  createSessionCookie,
  readJsonBody,
  register,
  type RegisterInput
} from "@/server/auth";

export async function POST(request: Request) {
  try {
    const input = await readJsonBody<RegisterInput>(request);
    const session = await register(input);

    return jsonData(session, {
      status: 201,
      headers: { "set-cookie": createSessionCookie(session) }
    });
  } catch (error) {
    return apiRouteError(error);
  }
}
