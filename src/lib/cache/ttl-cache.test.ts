import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TtlCache } from "./ttl-cache";

describe("TtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a stored value before expiry, undefined after", () => {
    const cache = new TtlCache<string>(1000, 10);
    cache.set("a", "hello");
    expect(cache.get("a")).toBe("hello");

    vi.advanceTimersByTime(999);
    expect(cache.get("a")).toBe("hello");

    vi.advanceTimersByTime(2);
    expect(cache.get("a")).toBeUndefined();
  });

  it("evicts the oldest entry once maxEntries is reached", () => {
    const cache = new TtlCache<number>(60_000, 2);
    cache.set("first", 1);
    cache.set("second", 2);
    cache.set("third", 3); // dépasse la limite : "first" éjecté

    expect(cache.get("first")).toBeUndefined();
    expect(cache.get("second")).toBe(2);
    expect(cache.get("third")).toBe(3);
    expect(cache.size).toBe(2);
  });

  it("overwriting an existing key does not evict anything", () => {
    const cache = new TtlCache<number>(60_000, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 10);

    expect(cache.get("a")).toBe(10);
    expect(cache.get("b")).toBe(2);
  });
});
