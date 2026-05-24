import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── Context Helpers ───────────────────────────────────────────────────────────

function makeCtx(role: "admin" | "user" = "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@amplify.com",
      name: "Test User",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Tests ────────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns the current user when authenticated", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("test@amplify.com");
    expect(result?.role).toBe("admin");
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const cleared: string[] = [];
    const ctx: TrpcContext = {
      ...makeCtx(),
      res: {
        clearCookie: (name: string) => { cleared.push(name); },
      } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(cleared).toContain(COOKIE_NAME);
  });
});

// ─── Pursuits Tests ────────────────────────────────────────────────────────────

describe("pursuits.list", () => {
  it("returns an array for authenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.pursuits.list({ limit: 10, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws UNAUTHORIZED for unauthenticated users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.pursuits.list({ limit: 10, offset: 0 })).rejects.toThrow();
  });
});

describe("pursuits.create", () => {
  it("throws UNAUTHORIZED for unauthenticated users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.pursuits.create({
      title: "Test Pursuit",
      clientName: "Test Agency",
      serviceLines: ["Special Inspections"],
      status: "identify",
    })).rejects.toThrow();
  });
});

// ─── Proposals Tests ───────────────────────────────────────────────────────────

describe("proposals.list", () => {
  it("returns an array for authenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.proposals.list({ limit: 10, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Assets Tests ──────────────────────────────────────────────────────────────

describe("assets.list", () => {
  it("returns an array for authenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.assets.list({ limit: 20, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("assets.getById", () => {
  it("returns null for a non-existent asset ID", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.assets.getById({ id: 999999 });
    expect(result).toBeNull();
  });
});

// ─── Personnel Tests ───────────────────────────────────────────────────────────

describe("personnel.list", () => {
  it("returns an array for authenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.personnel.list({ limit: 20, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Projects Tests ────────────────────────────────────────────────────────────

describe("projects.list", () => {
  it("returns an array for authenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.projects.list({ limit: 20, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Opportunities Tests ───────────────────────────────────────────────────────

describe("opportunities.list", () => {
  it("returns an array for authenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.opportunities.list({ limit: 20, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Contracts Tests ───────────────────────────────────────────────────────────

describe("contracts.list", () => {
  it("returns an array for authenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.contracts.list({ limit: 20, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── System Tests ──────────────────────────────────────────────────────────────

describe("auth.me (unauthenticated)", () => {
  it("returns null when called without a session", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});
