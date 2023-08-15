import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.198.0/assert/mod.ts";

type Parser<T> = (v: unknown) => Result<T>;
type Name = "boolean" | "string" | "number" | "object";

class Struct<T> {
  name: Name;
  parse: Parser<T>;
  TYPE!: T;
  constructor(name: Name, parser: Parser<T>) {
    this.name = name;
    this.parse = parser;
  }
}

type Infer<T extends Struct<unknown>> = T["TYPE"];

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

function err(error: string): Result<never> {
  return { success: false, error };
}

let bool = () =>
  new Struct<boolean>("boolean", (v: unknown) => {
    return typeof v === "boolean" ? ok(Boolean(v)) : err("Not a boolean");
  });

let string = () =>
  new Struct<string>("string", (v: unknown) => {
    return typeof v === "string" ? ok(String(v)) : err("Not a string");
  });

let number = () =>
  new Struct<number>("number", (v: unknown) => {
    return typeof v === "number" ? ok(Number(v)) : err("Not a number");
  });

// deno-lint-ignore ban-types
type Simplify<T> = { [K in keyof T]: T[K] } & {};
type ObjectSchema = Record<string, Struct<unknown>>;
type ObjectType<S extends ObjectSchema> = Simplify<
  { [K in keyof S]: Infer<S[K]> }
>;

let object = <S extends ObjectSchema>(shape: S) =>
  new Struct<ObjectType<S>>("object", (v: unknown) => {
    if (!isObject(v)) return err("Not an object");

    let data = {} as ObjectType<S>;
    let unknowns = new Set(Object.keys(v));

    for (let [key, type] of Object.entries(shape)) {
      let val = v[key as keyof typeof v];
      if (!val) return err(`Missing key '${key}'`);
      unknowns.delete(key);
      let result = type.parse(val);
      if (result.success) {
        let k: keyof S = key;
        data[k] = result.data;
      } else {
        return err(result.error);
      }
    }

    if (unknowns.size > 0) {
      let first = unknowns.values().next().value;
      return err(`Unknown key '${first}'`);
    }
    return ok(data);
  });

function isObject(o: unknown): o is Record<string | number | symbol, unknown> {
  return o != null && typeof o == "object" && !Array.isArray(o);
}

Deno.test("bool()", async (t) => {
  let schema = bool();
  await t.step("parses false", () => {
    let result = schema.parse(false);
    assert(result.success);
    assertEquals(result.data, false);
  });
  await t.step("parses true", () => {
    let result = schema.parse(true);
    assert(result.success);
    assertEquals(result.data, true);
  });
  await t.step("does not parses string", () => {
    let result = schema.parse("foo");
    assert(!result.success);
    assertEquals(result.error, "Not a boolean");
  });
  await t.step("does not coerce string", () => {
    let result = schema.parse("true");
    assert(!result.success);
    assertEquals(result.error, "Not a boolean");
  });
});

Deno.test("object()", async (t) => {
  let schema = object({ yes: bool(), message: string(), num: number() });
  await t.step("parses valid object", () => {
    let result = schema.parse({ yes: true, message: "ok", num: 7 });
    assert(result.success);
    assertEquals(result.data.yes, true);
    assertEquals(result.data.message, "ok");
  });
  await t.step("fails on first invalid key", () => {
    let result = schema.parse({ num: 7, yes: "true", message: 7 });
    assert(!result.success);
    assertEquals(result.error, "Not a boolean");
  });
  await t.step("fails on null", () => {
    let result = schema.parse(null);
    assert(!result.success);
    assertEquals(result.error, "Not an object");
  });
  await t.step("fails on missing key", () => {
    let result = schema.parse({ message: "ok" });
    assert(!result.success);
    assertEquals(result.error, "Missing key 'yes'");
  });
  await t.step("fails on unknown key", () => {
    let result = schema.parse({ yes: true, message: "ok", num: 7, foo: 7 });
    assert(!result.success);
    assertEquals(result.error, "Unknown key 'foo'");
  });
});
