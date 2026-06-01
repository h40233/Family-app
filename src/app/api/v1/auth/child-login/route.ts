import { jsonData } from "@/lib/api-response";
import {
  apiRouteError,
  childLogin,
  createSessionCookie,
  readJsonBody,
  type ChildLoginInput
} from "@/server/auth";

export async function POST(request: Request) {
  try {
    const input = await readJsonBody<ChildLoginInput>(request);
    const session = await childLogin(input);

    return jsonData(session, {
      status: 201,
      headers: { "set-cookie": createSessionCookie(session) }
    });
  } catch (error) {
    return apiRouteError(error);
  }
}
