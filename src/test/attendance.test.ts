import { describe, it, expect } from "vitest";
import { calculatePct, ATTENDED_STATUSES } from "@/lib/attendance";

describe("calculatePct", () => {
  it("returns 0 when conducted is 0", () => {
    expect(calculatePct(0, 0)).toBe(0);
  });
  it("returns 100 when all attended", () => {
    expect(calculatePct(10, 10)).toBe(100);
  });
  it("rounds to 2 decimals", () => {
    expect(calculatePct(1, 3)).toBe(33.33);
  });
});

describe("ATTENDED_STATUSES", () => {
  it("treats present, late, excused as attended", () => {
    expect(ATTENDED_STATUSES).toEqual(["present", "late", "excused"]);
  });
});
