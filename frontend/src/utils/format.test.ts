import { describe, expect, it } from "vitest";
import { bytes, count, latency, money, percent, shortId, terminal, title } from "./format";

describe("percent", () => {
  it("renders a fraction as a percentage", () => {
    expect(percent(0.925)).toBe("92.5%");
  });

  it("shows a dash when a metric has no value", () => {
    expect(percent(null)).toBe("—");
    expect(percent(undefined)).toBe("—");
  });

  it("does not confuse zero with an absent value", () => {
    expect(percent(0)).toBe("0%");
  });
});

describe("latency", () => {
  it("keeps sub-second values in milliseconds", () => {
    expect(latency(250.4)).toBe("250.4 ms");
  });

  it("switches to seconds past a second", () => {
    expect(latency(1500)).toBe("1.50 s");
  });

  it("shows a dash when the run never recorded a latency", () => {
    expect(latency(null)).toBe("—");
  });
});

describe("money", () => {
  it("keeps enough precision for per-token costs", () => {
    expect(money(0.000123)).toContain("0.000123");
  });

  it("accepts the string the API sends for decimals", () => {
    expect(money("1.5")).toBe(money(1.5));
  });

  it("shows a dash when there is no cost", () => {
    expect(money(null)).toBe("—");
  });
});

describe("bytes", () => {
  it("labels each magnitude", () => {
    expect(bytes(512)).toBe("512 B");
    expect(bytes(2048)).toBe("2.0 KB");
    expect(bytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("title", () => {
  it("turns a status code into a readable label", () => {
    expect(title("partially_failed")).toBe("Partially Failed");
  });
});

describe("shortId", () => {
  it("trims a uuid to its leading segment", () => {
    expect(shortId("de6decb8-3803-40d1-9aaf-6f6dc94fa93a")).toBe("de6decb8");
  });
});

describe("terminal", () => {
  it("recognises the statuses that stop polling", () => {
    expect(terminal("completed")).toBe(true);
    expect(terminal("failed")).toBe(true);
    expect(terminal("partially_failed")).toBe(true);
    expect(terminal("cancelled")).toBe(true);
  });

  it("keeps polling while work is outstanding", () => {
    expect(terminal("queued")).toBe(false);
    expect(terminal("running")).toBe(false);
  });
});

describe("count", () => {
  it("groups large numbers", () => {
    expect(count(1234567)).toMatch(/1\D?234\D?567/);
  });
});
