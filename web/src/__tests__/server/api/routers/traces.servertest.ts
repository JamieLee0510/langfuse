/** @jest-environment node */
import { pruneDatabase } from "@/src/__tests__/test-utils";
import { appRouter } from "@/src/server/api/root";
import { createInnerTRPCContext } from "@/src/server/api/trpc";
import { prisma } from "@langfuse/shared/src/db";
import type { Session } from "next-auth";

describe("Traces TRPC Router", () => {
  beforeEach(async () => await pruneDatabase());
  afterEach(async () => await pruneDatabase());

  const session: Session = {
    expires: "1",
    user: {
      id: "clgb17vnp000008jjere5g15i",
      name: "John Doe",
      organizations: [
        {
          id: "seed-org-id",
          role: "OWNER",
          plan: "cloud:hobby",
          cloudConfig: undefined,
          projects: [
            {
              id: "7a88fb47-b4e2-43b8-a06c-a5ce950dc53a",
              role: "ADMIN",
            },
          ],
        },
      ],
      featureFlags: {
        templateFlag: true,
      },
      admin: true,
    },
    environment: {} as any,
  };

  const ctx = createInnerTRPCContext({ session });
  const caller = appRouter.createCaller({ ...ctx, prisma });

  test("traces.all RPC returns an array of traces", async () => {
    const trace = {
      name: "trace-name",
      userId: "user-1",
      release: "1.0.0",
      version: "2.0.0",
    };
    await prisma.trace.create({
      data: { ...trace, projectId: "7a88fb47-b4e2-43b8-a06c-a5ce950dc53a" },
    });

    const traces = await caller.traces.all({
      page: 0,
      limit: 10,
      // projectId from `seed.ts`
      projectId: "7a88fb47-b4e2-43b8-a06c-a5ce950dc53a",
      filter: null,
      searchQuery: "",
      orderBy: null,
    });
    expect(traces).toBeDefined();
    expect(traces).toMatchObject({ traces: [trace] });
  });

  test("traces.all RPC must not return input, output, metadata", async () => {
    const trace = {
      name: "trace-name",
      userId: "user-1",
      input: { a: 1 },
      output: { b: 2 },
      metadata: { c: 3 },
      release: "1.0.0",
      version: "2.0.0",
    };
    await prisma.trace.create({
      data: { ...trace, projectId: "7a88fb47-b4e2-43b8-a06c-a5ce950dc53a" },
    });

    const traces = await caller.traces.all({
      page: 0,
      limit: 10,
      // projectId from `seed.ts`
      projectId: "7a88fb47-b4e2-43b8-a06c-a5ce950dc53a",
      filter: null,
      searchQuery: "",
      orderBy: null,
    });
    expect(traces.traces).toBeDefined();
    expect(traces.traces).toHaveLength(1);

    const returnedTrace = traces.traces[0];
    expect(returnedTrace).not.toHaveProperty("input");
    expect(returnedTrace).not.toHaveProperty("output");
    expect(returnedTrace).not.toHaveProperty("metadata");
  });

  test("traces.all RPC orders traces by userId", async () => {
    const traceTmpl = {
      name: "trace-name",
      userId: "user-1",
      release: "1.0.0",
      version: "2.0.0",
    };
    const trace1 = traceTmpl;
    const trace2 = { ...traceTmpl, userId: "user-2" };
    await prisma.trace.create({
      data: { ...traceTmpl, projectId: "7a88fb47-b4e2-43b8-a06c-a5ce950dc53a" },
    });
    await prisma.trace.create({
      data: {
        ...trace2,
        projectId: "7a88fb47-b4e2-43b8-a06c-a5ce950dc53a",
      },
    });

    const tracesASC = await caller.traces.all({
      page: 0,
      limit: 10,
      // projectId from `seed.ts`
      projectId: "7a88fb47-b4e2-43b8-a06c-a5ce950dc53a",
      filter: null,
      searchQuery: "",
      orderBy: {
        column: "userId",
        order: "ASC",
      },
    });
    expect(tracesASC).toMatchObject({ traces: [trace1, trace2] });

    const tracesDESC = await caller.traces.all({
      page: 0,
      limit: 10,
      // projectId from `seed.ts`
      projectId: "7a88fb47-b4e2-43b8-a06c-a5ce950dc53a",
      filter: null,
      searchQuery: "",
      orderBy: {
        column: "userId",
        order: "DESC",
      },
    });
    expect(tracesDESC).toMatchObject({ traces: [trace2, trace1] });
  });
});
