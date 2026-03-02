import { recalcUserState } from "./stateEngine";

const fromMock = jest.fn();
const upsertMock = jest.fn(async () => ({ data: null, error: null }));

jest.mock("../supabaseClient", () => ({
  supabase: {
    from: (...args) => fromMock(...args),
  },
}));

const makeStrengthQuery = (result) => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      gte: jest.fn(async () => result),
    })),
  })),
});

const makeSessionQuery = (result) => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      gte: jest.fn(async () => result),
    })),
  })),
});

const makeActivityQuery = (result) => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      order: jest.fn(() => ({
        limit: jest.fn(async () => result),
      })),
    })),
  })),
});

const makeUserStateQuery = (existingResult) => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      single: jest.fn(async () => existingResult),
    })),
  })),
  upsert: upsertMock,
});

describe("recalcUserState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("does not upsert xp/level/rank/last_activity (server-authoritative fields)", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "strength_logs") {
        return makeStrengthQuery({
          data: [{ effort_level: 6, is_personal_best: true }],
          error: null,
        });
      }
      if (table === "training_sessions") {
        return makeSessionQuery({
          data: [{ effort_level: 5, is_personal_best: false }],
          error: null,
        });
      }
      if (table === "daily_activity") {
        return makeActivityQuery({
          data: [{ activity_date: "2026-03-01" }],
          error: null,
        });
      }
      if (table === "user_state") {
        return makeUserStateQuery({
          data: { xp: 120, level: 3, rank: "C", last_activity: "2026-03-01T00:00:00Z" },
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    await recalcUserState(7);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const payload = upsertMock.mock.calls[0][0];
    expect(payload.user_id).toBe(7);
    expect(payload).not.toHaveProperty("xp");
    expect(payload).not.toHaveProperty("level");
    expect(payload).not.toHaveProperty("rank");
    expect(payload).not.toHaveProperty("last_activity");
    expect(payload).toHaveProperty("updated_at");
    expect(payload).toHaveProperty("fatigue_score");
    expect(payload).toHaveProperty("recovery_score");
    expect(payload).toHaveProperty("momentum_score");
    expect(payload).toHaveProperty("streak_days");
  });

  test("aborts and does not upsert when any upstream query errors", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "strength_logs") {
        return makeStrengthQuery({
          data: null,
          error: { message: "boom" },
        });
      }
      if (table === "training_sessions") {
        return makeSessionQuery({ data: [], error: null });
      }
      if (table === "daily_activity") {
        return makeActivityQuery({ data: [], error: null });
      }
      if (table === "user_state") {
        return makeUserStateQuery({ data: {}, error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    await recalcUserState(8);

    expect(upsertMock).not.toHaveBeenCalled();
  });
});
