import { describe, expect, it } from "vitest";
import { remainingMs } from "@/lib/session";

const ts = 1_800_000_000;
const at = (min: number) => (ts + min * 60) * 1000;

describe("table play pass", () => {
  it("allows play for 60 minutes by default", () => {
    expect(remainingMs(ts, undefined, at(59))).toBe(60_000);
  });
  it("locks after 60 minutes", () => {
    expect(remainingMs(ts, 60, at(61))).toBe(0);
  });
  it("locks without a waiter pass", () => {
    expect(remainingMs(undefined, 60, at(1))).toBe(0);
  });
  it("a renewed QR (new ts) grants a fresh 60 minutes", () => {
    expect(remainingMs(ts + 3600, 60, at(61))).toBe(59 * 60_000);
  });
});
