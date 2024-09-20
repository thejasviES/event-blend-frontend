import {
  globalAction$,
  RequestHandler,
  routeLoader$,
} from "@builder.io/qwik-city";
import { REDIRECT_STATUS_CODE } from "./constatnts";
import { fetchBackend } from "./fetch-backend";
import { ApiResponse, AuthUser } from "./types";
import { event$, implicit$FirstArg, QRL } from "@builder.io/qwik";
import { isServer } from "@builder.io/qwik/build";

export const Auth$ = /*#__PURE__*/ implicit$FirstArg(AuthQrl);

async function getCurrentUser(accessToken: string) {
  const resp = await fetchBackend
    .headers({ Authorization: `Bearer ${accessToken}` })
    .get("/auth/me")
    .json<ApiResponse<{ user: AuthUser }>>();

  if (!resp.data?.user) return null;
  return resp.data.user;
}

export function AuthQrl() {
  const onRequest: RequestHandler = async (event) => {
    if (isServer) {
      const accessToken = event.cookie.get("accessToken")?.value;
      if (accessToken) {
        event.sharedMap.set("accessToken", accessToken);
        const user = await getCurrentUser(accessToken);
        event.sharedMap.set("user", user);
      }
    }
  };

  const useSession = routeLoader$(async (event) => {
    const user = event.sharedMap.get("user") as AuthUser | null | undefined;
    return { user };
  });

  const useLogout = globalAction$(async (_, event) => {
    // logout from server
    const accessToken = event.sharedMap.get("accessToken");
    if (!accessToken) throw event.redirect(REDIRECT_STATUS_CODE, "/login");
    const resp = await fetchBackend
      .url("/auth/logout")
      .headers({
        Authorization: `Bearer ${accessToken}`,
      })
      .post()
      .json<ApiResponse>();

    if (resp.success) {
      // delete access token from cookie
      event.cookie.delete("accessToken");

      // delete refresh token from cookie
      event.cookie.delete("refreshToken");

      // remove sharedmap data related to accessToken and user
      event.sharedMap.delete("user");
      event.sharedMap.delete("accessToken");

      // redirect to home page
      throw event.redirect(REDIRECT_STATUS_CODE, "/");
    }
  });

  return { onRequest, useSession, useLogout };
}
