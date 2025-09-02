// Lightweight CLI helper for zscripts
// Provides defineCli() for per-script typed args, hints, and help output.

import { parseArgs } from "jsr:@std/cli/parse-args";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

export { z };

export type AnyZod = z.ZodTypeAny;

export type Positional<
  Name extends string = string,
  T extends AnyZod = AnyZod
> = {
  name: Name;
  type: T; // Use z.coerce.* for convenient type coercion
  description?: string;
};

export type FlagSchemas = Record<string, AnyZod>;

export type CliDefinition<
  TFlags extends FlagSchemas = FlagSchemas,
  TPos extends readonly Positional<string, AnyZod>[] = readonly Positional<
    string,
    AnyZod
  >[]
> = {
  description?: string;
  hint?: string;
  examples?: string[];
  flags?: TFlags;
  positionals?: TPos;
  aliases?: Record<string, string>; // alias -> canonical
};

// Type-level mapping from defs to a ZodObject shape
type FlagsToShape<T extends FlagSchemas | undefined> = T extends FlagSchemas
  ? { [K in keyof T]: T[K] }
  : {};
// For positionals, turn an array of { name, type } into a record of name -> type
type PosToShape<T extends readonly Positional<string, AnyZod>[] | undefined> =
  T extends readonly Positional<string, AnyZod>[]
    ? { [K in T[number] as K["name"]]: K["type"] }
    : {};

type Merge<A, B> = A & B;

type ExtraShape = { _: z.ZodOptional<z.ZodArray<z.ZodString>> };

export type ScriptMeta = {
  description?: string;
  hint?: string;
  examples?: string[];
  positionals?: readonly Positional[];
  flags?: FlagSchemas;
  aliases?: Record<string, string>;
};

export type ParsedArgs = Record<string, unknown> & { _?: string[] };

function normalizeAliases(
  obj: Record<string, unknown>,
  aliases?: Record<string, string>
) {
  if (!aliases) return obj;
  const out: Record<string, unknown> = { ...obj };
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (alias in out) {
      if (!(canonical in out)) {
        out[canonical] = out[alias];
      }
      delete out[alias];
    }
  }
  return out;
}

function buildSchema<
  TFlags extends FlagSchemas | undefined,
  TPos extends readonly Positional<string, AnyZod>[] | undefined
>(def: { flags?: TFlags; positionals?: TPos }) {
  const shape: Record<string, z.ZodTypeAny> = {};
  if (def.flags) {
    for (const [k, s] of Object.entries(def.flags)) {
      shape[k] = s as z.ZodTypeAny;
    }
  }
  if (def.positionals) {
    (def.positionals as readonly Positional<string, AnyZod>[]).forEach((p) => {
      shape[p.name] = p.type;
    });
  }
  // Always allow raw positionals for convenience (optional)
  shape._ = z.array(z.string()).optional();
  return z.object(shape).strict() as unknown as z.ZodObject<
    Merge<FlagsToShape<TFlags>, Merge<PosToShape<TPos>, ExtraShape>>
  >;
}

function buildBooleanKeys(def: CliDefinition): string[] {
  const bools: string[] = [];
  if (!def.flags) return bools;
  for (const [k, schema] of Object.entries(def.flags)) {
    // Heuristic: flag schema resolves to boolean if inner-most is ZodBoolean
    let cur: z.ZodTypeAny | undefined = schema;
    // unwrap effects/optional/default
    while (cur) {
      // deno-lint-ignore no-explicit-any
      const anyCur: any = cur as any;
      if (anyCur._def?.innerType) {
        cur = anyCur._def.innerType;
      } else if (anyCur._def?.schema) {
        cur = anyCur._def.schema; // default() wraps .schema
      } else {
        break;
      }
    }
    // deno-lint-ignore no-explicit-any
    const tag = (cur as any)?._def?.typeName as string | undefined;
    if (tag === "ZodBoolean") bools.push(k);
  }
  return bools;
}

type BaseDef = {
  description?: string;
  hint?: string;
  examples?: string[];
  aliases?: Record<string, string>;
};

export function defineCli<
  TFlags extends FlagSchemas | undefined,
  TPos extends readonly Positional<string, AnyZod>[] | undefined
>(def: BaseDef & { flags?: TFlags; positionals?: TPos }) {
  const schema = buildSchema<TFlags, TPos>(def);
  const meta: ScriptMeta = {
    description: def.description,
    hint: def.hint,
    examples: def.examples,
    positionals: def.positionals,
    flags: def.flags,
    aliases: def.aliases,
  };

  function parse(argv: string[]) {
    const booleanKeys = buildBooleanKeys(def as CliDefinition);
    const raw = parseArgs(argv, {
      boolean: booleanKeys,
      alias: def.aliases as Record<string, string> | undefined,
      // allow unknown flags; we'll validate with zod
      stopEarly: false,
      // ensure "--" passthrough goes to _
      "--": true,
    }) as ParsedArgs;

    // normalize aliases to canonical
    const normalized = normalizeAliases(
      raw as Record<string, unknown>,
      def.aliases
    );

    const mapped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(normalized)) {
      if (k === "_" || k === "--") continue; // ignore parser internals
      mapped[k] = v;
    }
    // map positionals (if declared) into named keys
    const pos = (raw._ ?? []) as string[];
    (
      def.positionals as readonly Positional<string, AnyZod>[] | undefined
    )?.forEach((p, i) => {
      if (pos[i] !== undefined) mapped[p.name] = pos[i];
    });
    // also pass through raw positionals
    (mapped as any)._ = pos;
    return schema.parse(mapped);
  }

  function helpText(scriptName?: string): string {
    const usageParts: string[] = [];
    if (def.positionals?.length) {
      for (const p of def.positionals) {
        // naive optional detection: check if default/optional/effects present
        // We don't introspect deeply; bracket to show optional-ish
        const name = p.name;
        usageParts.push(`<${name}>`);
      }
    }
    const usage = `zscripts ${scriptName ?? "<script>"}${
      usageParts.length ? " " + usageParts.join(" ") : ""
    } [options]`;
    const lines: string[] = [];
    lines.push(usage);
    if (meta.description) lines.push("", meta.description);
    if (meta.hint) lines.push("", meta.hint);
    if (def.positionals?.length) {
      lines.push("", "Positionals:");
      for (const p of def.positionals) {
        lines.push(`  ${p.name}${p.description ? " - " + p.description : ""}`);
      }
    }
    if (def.flags && Object.keys(def.flags).length) {
      lines.push("", "Options:");
      for (const key of Object.keys(def.flags)) {
        const aliases = Object.entries(def.aliases ?? {})
          .filter(([, canonical]) => canonical === key)
          .map(([alias]) => `-${alias}`);
        const aliasTxt = aliases.length ? ` (${aliases.join(", ")})` : "";
        lines.push(`  --${key}${aliasTxt}`);
      }
    }
    if (meta.examples?.length) {
      lines.push("", "Examples:");
      for (const ex of meta.examples) lines.push(`  ${ex}`);
    }
    return lines.join("\n");
  }

  return { meta, schema, parse, helpText } as const;
}

export type InferCli<T> = T extends { schema: infer S }
  ? S extends z.ZodType<any, any, any>
    ? z.infer<S>
    : never
  : never;
export type ScriptModule<TArgs = unknown> = {
  run: (args: TArgs) => unknown | Promise<unknown>;
  cli?: ReturnType<typeof defineCli>;
  meta?: ScriptMeta; // optional; prefer cli.meta if both exist
};

// --- Sugar: object-shaped positionals and tiny helpers ---
export const str = () => z.string();
export const num = () => z.coerce.number();
export const bool = () => z.boolean();

// Shape from a positionals object: key -> zod schema
type FromPosObj<TPos extends Record<string, AnyZod> | undefined> =
  TPos extends Record<string, AnyZod> ? { [K in keyof TPos]: TPos[K] } : {};

type ShapeFromDefs<
  TFlags extends Record<string, AnyZod> | undefined,
  TPos extends Record<string, AnyZod> | undefined
> = Merge<FlagsToShape<TFlags>, Merge<FromPosObj<TPos>, ExtraShape>>;

export function defineCliSimple<
  TFlags extends { [K in keyof TFlags]: AnyZod } | undefined,
  TPos extends { [K in keyof TPos]: AnyZod } | undefined
>(def: {
  description?: string;
  hint?: string;
  examples?: string[];
  flags?: TFlags;
  positionals?: TPos;
  aliases?: Record<string, string>;
  docs?: {
    positionals?: { [K in keyof TPos & string]?: string };
    flags?: { [K in keyof TFlags & string]?: string };
  };
}) {
  // Build positionals array from object keys for runtime parsing and help.
  const posArrayRuntime = def.positionals
    ? (Object.entries(def.positionals).map(([name, type]) => ({
        name,
        // deno-lint-ignore no-explicit-any
        type: type as any,
        description:
          def.docs?.positionals?.[
            name as keyof typeof def.positionals & string
          ],
      })) as unknown as { name: string; type: AnyZod; description?: string }[])
    : undefined;

  const base = defineCli({
    description: def.description,
    hint: def.hint,
    examples: def.examples,
    flags: def.flags as any,
    positionals: posArrayRuntime as any,
    aliases: def.aliases,
  });

  // Re-type the returned object so schema/parse reflect the object-shaped positionals.
  return base as unknown as {
    meta: typeof base.meta;
    schema: z.ZodObject<ShapeFromDefs<TFlags, TPos>>;
    parse: (
      argv: string[]
    ) => z.infer<z.ZodObject<ShapeFromDefs<TFlags, TPos>>>;
    helpText: typeof base.helpText;
  };
}
