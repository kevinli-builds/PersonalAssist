import { describe, it, expect } from "vitest";
import { sanitizeEntryPatch } from "../entryPatch";

describe("sanitizeEntryPatch", () => {
  it("accepts a title change and trims it", () => {
    const r = sanitizeEntryPatch({ title: "  Flu shot  " });
    expect(r.data).toEqual({ title: "Flu shot" });
  });

  it("rejects an empty title", () => {
    expect(sanitizeEntryPatch({ title: "   " }).error).toBeTruthy();
  });

  it("accepts an empty note (clears it)", () => {
    const r = sanitizeEntryPatch({ note: "" });
    expect(r.data).toEqual({ note: "" });
  });

  it("parses an ISO date and accepts null to clear", () => {
    const r = sanitizeEntryPatch({ date: "2026-03-14T00:00:00.000Z" });
    expect(r.data?.date).toBeInstanceOf(Date);
    expect(sanitizeEntryPatch({ date: null }).data).toEqual({ date: null });
  });

  it("rejects garbage dates and non-string titles", () => {
    expect(sanitizeEntryPatch({ date: "not-a-date" }).error).toBeTruthy();
    expect(sanitizeEntryPatch({ date: 42 }).error).toBeTruthy();
    expect(sanitizeEntryPatch({ title: 42 }).error).toBeTruthy();
  });

  it("rejects an empty patch and non-object bodies", () => {
    expect(sanitizeEntryPatch({}).error).toBeTruthy();
    expect(sanitizeEntryPatch(null).error).toBeTruthy();
    expect(sanitizeEntryPatch([1]).error).toBeTruthy();
    expect(sanitizeEntryPatch({ unknownField: 1 }).error).toBeTruthy();
  });

  it("caps runaway lengths", () => {
    const r = sanitizeEntryPatch({ title: "x".repeat(1000) });
    expect(r.data?.title?.length).toBe(300);
  });
});
