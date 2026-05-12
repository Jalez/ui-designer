import { describe, expect, test } from "bun:test";
import { resolveAppRouteUrl } from "./urls";

function request() {
  return new Request("http://internal.local/request");
}

function withAppRootUrl<T>(value: string | undefined, run: () => T): T {
  const previous = process.env.APP_ROOT_URL;
  if (value === undefined) {
    delete process.env.APP_ROOT_URL;
  } else {
    process.env.APP_ROOT_URL = value;
  }

  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete process.env.APP_ROOT_URL;
    } else {
      process.env.APP_ROOT_URL = previous;
    }
  }
}

describe("server app route URLs", () => {
  test("builds absolute route URLs for root deployments", () => {
    withAppRootUrl("https://example.com", () => {
      expect(resolveAppRouteUrl(request(), "/api/foo")).toBe("https://example.com/api/foo");
    });
  });

  test("preserves deployment base path", () => {
    withAppRootUrl("https://example.com/hello-ui", () => {
      expect(resolveAppRouteUrl(request(), "/api/foo")).toBe("https://example.com/hello-ui/api/foo");
    });
  });

  test("normalizes trailing slashes on app root", () => {
    withAppRootUrl("https://example.com/hello-ui/", () => {
      expect(resolveAppRouteUrl(request(), "/api/foo")).toBe("https://example.com/hello-ui/api/foo");
    });
  });

  test("normalizes route paths without a leading slash", () => {
    withAppRootUrl("https://example.com/hello-ui", () => {
      expect(resolveAppRouteUrl(request(), "api/foo")).toBe("https://example.com/hello-ui/api/foo");
    });
  });

  test("keeps the LTI game launch canonical URL under the app base path", () => {
    withAppRootUrl("https://itc-games.rd.tuni.fi/hello-ui", () => {
      expect(resolveAppRouteUrl(request(), "/api/lti/game/game-1")).toBe(
        "https://itc-games.rd.tuni.fi/hello-ui/api/lti/game/game-1",
      );
    });
  });
});
