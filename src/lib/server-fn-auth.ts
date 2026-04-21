import { supabase } from "@/integrations/supabase/client";

let installed = false;

/**
 * Patch the global `fetch` so any request to TanStack server functions
 * (path starts with `/_serverFn/`) carries the current Supabase access
 * token. Server-function middlewares like `requireSupabaseAuth` rely on
 * this Bearer header.
 */
export function installServerFnAuth() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    let url = "";
    if (typeof input === "string") url = input;
    else if (input instanceof URL) url = input.toString();
    else if (input instanceof Request) url = input.url;

    const isServerFn =
      url.startsWith("/_serverFn/") ||
      url.includes("/_serverFn/") ||
      url.startsWith("_serverFn/");

    if (!isServerFn) return originalFetch(input as RequestInfo, init);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return originalFetch(input as RequestInfo, init);

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return originalFetch(input as RequestInfo, { ...(init ?? {}), headers });
  };
}
