import { describe, expect, it } from "vitest";

import { parseSpreadsheetId } from "./client";

describe("parseSpreadsheetId", () => {
  it("extracts the ID from a standard edit URL", () => {
    expect(parseSpreadsheetId("https://docs.google.com/spreadsheets/d/1a2B3c4D5e/edit#gid=0")).toBe("1a2B3c4D5e");
  });

  it("extracts the ID from a bare URL with no trailing segment", () => {
    expect(parseSpreadsheetId("https://docs.google.com/spreadsheets/d/1a2B3c4D5e")).toBe("1a2B3c4D5e");
  });

  it("extracts the ID when the URL has extra query params", () => {
    expect(parseSpreadsheetId("https://docs.google.com/spreadsheets/d/abc-XYZ_123/edit?usp=sharing")).toBe(
      "abc-XYZ_123"
    );
  });

  it("returns null for a URL that isn't a Google Sheets link", () => {
    expect(parseSpreadsheetId("https://example.com/not-a-sheet")).toBeNull();
    expect(parseSpreadsheetId("https://docs.google.com/document/d/1a2B3c4D5e/edit")).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(parseSpreadsheetId("not a url at all")).toBeNull();
    expect(parseSpreadsheetId("")).toBeNull();
  });
});
