import { describe, expect, it } from "vitest";
import {
  TRY_COOKIE,
  TRY_ITEMS,
  allDone,
  cookieValue,
  markDone,
  parseTryState,
  setClosed,
  tryCookie,
} from "./things-to-try";

const fresh = parseTryState(undefined);

// What a cookie assignment would store, as the next request would send it.
const stored = (assignment: string) =>
  cookieValue(assignment.split(";")[0], TRY_COOKIE);

describe("parseTryState", () => {
  it("starts with nothing done and the list open", () => {
    expect(fresh).toEqual({ done: [], closed: false });
    expect(parseTryState("")).toEqual(fresh);
  });

  it("reads what's done and whether it's closed", () => {
    expect(parseTryState("search.drag.closed")).toEqual({
      done: ["drag", "search"],
      closed: true,
    });
  });

  it("drops parts it doesn't know, so an edited cookie can't break the page", () => {
    expect(parseTryState("drag.tour.CLOSED.connect.connect")).toEqual({
      done: ["drag", "connect"],
      closed: false,
    });
  });
});

describe("markDone", () => {
  it("ticks a line and keeps the checklist's order", () => {
    const state = markDone(markDone(fresh, "connect"), "drag");
    expect(state.done).toEqual(["drag", "connect"]);
  });

  it("changes nothing for a line already ticked", () => {
    const once = markDone(fresh, "search");
    expect(markDone(once, "search")).toBe(once);
  });

  it("leaves a closed checklist closed", () => {
    expect(markDone(setClosed(fresh, true), "describe").closed).toBe(true);
  });
});

describe("allDone", () => {
  it("is true only once all four are ticked", () => {
    const three = ["drag", "search", "describe"] as const;
    const state = three.reduce(markDone, fresh);
    expect(allDone(state)).toBe(false);
    expect(allDone(markDone(state, "connect"))).toBe(true);
  });
});

describe("tryCookie", () => {
  it("lasts as long as a demo guest does", () => {
    expect(tryCookie(markDone(fresh, "drag"))).toBe(
      `${TRY_COOKIE}=drag; Path=/; Max-Age=86400; SameSite=Lax`,
    );
  });

  it("deletes the cookie for the starting state", () => {
    expect(tryCookie(fresh)).toBe(
      `${TRY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
    );
  });

  it("writes a value it reads back", () => {
    const state = setClosed(markDone(markDone(fresh, "search"), "drag"), true);
    expect(parseTryState(stored(tryCookie(state)))).toEqual(state);
  });

  it("stores only characters a cookie value allows", () => {
    const everything = setClosed(TRY_ITEMS.reduce(markDone, fresh), true);
    expect(stored(tryCookie(everything))).toMatch(/^[a-z.]+$/);
  });
});

describe("cookieValue", () => {
  it("finds one cookie among several", () => {
    expect(
      cookieValue("snippr-theme=8bit; snippr-try=drag.closed; x=1", TRY_COOKIE),
    ).toBe("drag.closed");
  });

  it("is undefined when the cookie isn't there", () => {
    expect(cookieValue("", TRY_COOKIE)).toBeUndefined();
    expect(cookieValue("snippr-tryhard=1", TRY_COOKIE)).toBeUndefined();
  });
});
