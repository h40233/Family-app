import { jsonData } from "@/lib/api-response";
import {
  apiRouteError,
  createSessionCookie,
  login,
  readJsonBody,
  type LoginInput
} from "@/server/auth";

export async function POST(request: Request) {
  try {
    const input = await readJsonBody<LoginInput>(request);
    const session = await login(input);

    return jsonData(session, {
      status: 201,
      headers: { "set-cookie": createSessionCookie(session) }
    });
  } catch (error) {
    return apiRouteError(error);
  }
}
