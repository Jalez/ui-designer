import test from "node:test";
import assert from "node:assert/strict";

type QueryResult = { rows?: Array<Record<string, unknown>> };
type RouteModule = {
  mergeProgressData: (
    existingProgressData: unknown,
    nextProgressData: unknown,
  ) => Record<string, unknown>;
  resolveGroupInstance: (
    sql: { query: (query: string, params: unknown[]) => Promise<QueryResult> },
    gameId: string,
    groupId: string,
  ) => Promise<unknown>;
  resolveIndividualInstance: (
    sql: { query: (query: string, params: unknown[]) => Promise<QueryResult> },
    gameId: string,
    userId: string,
  ) => Promise<unknown>;
};

async function loadRouteModule(): Promise<RouteModule> {
  const importedRouteModule = await import("./[id]/instance/route");
  return ((
    importedRouteModule as {
      default?: Partial<RouteModule>;
      mergeProgressData?: RouteModule["mergeProgressData"];
      resolveGroupInstance?: RouteModule["resolveGroupInstance"];
      resolveIndividualInstance?: RouteModule["resolveIndividualInstance"];
    }
  ).default ?? importedRouteModule) as RouteModule;
}

test("mergeProgressData preserves known points when a concurrent incomplete score arrives", async () => {
  const routeModule = await loadRouteModule();
  assert.equal(typeof routeModule.mergeProgressData, "function");

  const merged = routeModule.mergeProgressData(
    {
      pointsByLevel: {
        "Level 1": {
          points: 100,
          maxPoints: 100,
          accuracy: 100,
          bestTime: "0:00:01",
          scenarios: [
            {
              scenarioId: "scenario-1",
              accuracy: 100,
              meanAccuracyKnown: true,
            },
          ],
        },
      },
    },
    {
      pointsByLevel: {
        "Level 1": {
          points: 0,
          maxPoints: 100,
          accuracy: 0,
          bestTime: "0:0",
          scenarios: [
            {
              scenarioId: "scenario-1",
              accuracy: 0,
              meanAccuracyKnown: false,
            },
          ],
        },
      },
    },
  );

  assert.deepEqual((merged.pointsByLevel as Record<string, unknown>)["Level 1"], {
    points: 100,
    maxPoints: 100,
    accuracy: 100,
    bestTime: "0:00:01",
    scenarios: [
      {
        scenarioId: "scenario-1",
        accuracy: 100,
        meanAccuracyKnown: true,
      },
    ],
  });
});

test("mergeProgressData accepts known points updates even when accuracy decreases", async () => {
  const routeModule = await loadRouteModule();
  assert.equal(typeof routeModule.mergeProgressData, "function");

  const merged = routeModule.mergeProgressData(
    {
      pointsByLevel: {
        "Level 1": {
          points: 100,
          maxPoints: 100,
          accuracy: 100,
          bestTime: "0:00:01",
          scenarios: [
            {
              scenarioId: "scenario-1",
              accuracy: 100,
              meanAccuracyKnown: true,
            },
          ],
        },
      },
    },
    {
      pointsByLevel: {
        "Level 1": {
          points: 25,
          maxPoints: 100,
          accuracy: 72,
          bestTime: "0:00:03",
          scenarios: [
            {
              scenarioId: "scenario-1",
              accuracy: 72,
              meanAccuracyKnown: true,
            },
          ],
        },
      },
    },
  );

  assert.deepEqual((merged.pointsByLevel as Record<string, unknown>)["Level 1"], {
    points: 25,
    maxPoints: 100,
    accuracy: 72,
    bestTime: "0:00:03",
    scenarios: [
      {
        scenarioId: "scenario-1",
        accuracy: 72,
        meanAccuracyKnown: true,
      },
    ],
  });
});

test("resolveGroupInstance recovers from concurrent duplicate-key race", async () => {
  const routeModule = await loadRouteModule();
  assert.equal(typeof routeModule.resolveGroupInstance, "function");

  const queries: Array<{ query: string; params: unknown[] }> = [];
  let selectCount = 0;
  let insertCount = 0;
  let releaseSelects: (() => void) | null = null;
  const bothSelectsStarted = new Promise<void>((resolve) => {
    releaseSelects = resolve;
  });

  const duplicateError = Object.assign(
    new Error('duplicate key value violates unique constraint "idx_game_instances_group_unique"'),
    {
      code: "23505",
      constraint: "idx_game_instances_group_unique",
    },
  );
  let createdRow: Record<string, unknown> | null = null;

  const sql = {
    async query(query: string, params: unknown[]): Promise<QueryResult> {
      queries.push({ query, params });

      if (query.includes("SELECT id, progress_data FROM game_instances")) {
        selectCount += 1;
        if (selectCount === 2) {
          releaseSelects?.();
        }
        await bothSelectsStarted;
        return { rows: createdRow ? [createdRow] : [] };
      }

      if (query.includes("INSERT INTO game_instances")) {
        insertCount += 1;
        if (insertCount === 1) {
          createdRow = {
            id: "instance-1",
            progress_data: {
              groupStartGate: {
                status: "waiting",
                minReadyCount: 2,
                readyUserIds: [],
                readyUsers: {},
                startedAt: null,
                startedByUserId: null,
              },
            },
          };
          return {
            rows: [createdRow],
          };
        }
        throw duplicateError;
      }

      throw new Error(`Unexpected query in test:\n${query}`);
    },
    async unsafe(): Promise<QueryResult> {
      throw new Error("unsafe() should not be called in this test");
    },
  };

  const [firstResult, secondResult] = await Promise.allSettled([
    routeModule.resolveGroupInstance(sql, "game-1", "group-1"),
    routeModule.resolveGroupInstance(sql, "game-1", "group-1"),
  ]);

  assert.equal(selectCount, 3);
  assert.equal(insertCount, 2);
  assert.equal(
    queries.filter((entry) => entry.query.includes("SELECT id, progress_data FROM game_instances")).length,
    3,
  );
  assert.equal(
    queries.filter((entry) => entry.query.includes("INSERT INTO game_instances")).length,
    2,
  );

  assert.equal(firstResult.status, "fulfilled");
  assert.equal(secondResult.status, "fulfilled");
  assert.equal(
    firstResult.status === "fulfilled" ? (firstResult.value as { instance: { id: string } }).instance.id : undefined,
    "instance-1",
  );
  assert.equal(
    secondResult.status === "fulfilled" ? (secondResult.value as { instance: { id: string } }).instance.id : undefined,
    "instance-1",
  );
});

test("resolveIndividualInstance recovers from concurrent duplicate-key race", async () => {
  const routeModule = await loadRouteModule();
  assert.equal(typeof routeModule.resolveIndividualInstance, "function");

  let selectCount = 0;
  let insertCount = 0;
  let releaseSelects: (() => void) | null = null;
  const bothSelectsStarted = new Promise<void>((resolve) => {
    releaseSelects = resolve;
  });
  const duplicateError = Object.assign(
    new Error('duplicate key value violates unique constraint "idx_game_instances_individual_unique"'),
    {
      code: "23505",
      constraint: "idx_game_instances_individual_unique",
    },
  );
  let createdRow: Record<string, unknown> | null = null;

  const sql = {
    async query(query: string): Promise<QueryResult> {
      if (query.includes("SELECT id, progress_data FROM game_instances")) {
        selectCount += 1;
        if (selectCount === 2) {
          releaseSelects?.();
        }
        await bothSelectsStarted;
        return { rows: createdRow ? [createdRow] : [] };
      }

      if (query.includes("INSERT INTO game_instances")) {
        insertCount += 1;
        if (insertCount === 1) {
          createdRow = {
            id: "instance-individual-1",
            progress_data: {},
          };
          return { rows: [createdRow] };
        }
        throw duplicateError;
      }

      throw new Error(`Unexpected query in test:\n${query}`);
    },
    async unsafe(): Promise<QueryResult> {
      throw new Error("unsafe() should not be called in this test");
    },
  };

  const [firstResult, secondResult] = await Promise.allSettled([
    routeModule.resolveIndividualInstance(sql, "game-1", "user-1"),
    routeModule.resolveIndividualInstance(sql, "game-1", "user-1"),
  ]);

  assert.equal(selectCount, 3);
  assert.equal(insertCount, 2);
  assert.equal(firstResult.status, "fulfilled");
  assert.equal(secondResult.status, "fulfilled");
  assert.equal(
    firstResult.status === "fulfilled" ? (firstResult.value as { instance: { id: string } }).instance.id : undefined,
    "instance-individual-1",
  );
  assert.equal(
    secondResult.status === "fulfilled" ? (secondResult.value as { instance: { id: string } }).instance.id : undefined,
    "instance-individual-1",
  );
});
