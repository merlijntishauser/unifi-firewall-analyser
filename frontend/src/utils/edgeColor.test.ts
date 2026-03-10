import { describe, it, expect } from "vitest";
import { getActionColor } from "./edgeColor";

describe("getActionColor", () => {
  it("returns green for ALLOW", () => {
    expect(getActionColor("ALLOW")).toBe("#00d68f");
  });

  it("returns red for BLOCK", () => {
    expect(getActionColor("BLOCK")).toBe("#ff4d5e");
  });

  it("returns red for REJECT", () => {
    expect(getActionColor("REJECT")).toBe("#ff4d5e");
  });

  it("returns red for unknown action", () => {
    expect(getActionColor("OTHER")).toBe("#ff4d5e");
  });
});
