import * as path from "jsr:@std/path";
import { defineCliSimple, str, bool, type InferCli } from "../cli.ts";

export const cli = defineCliSimple({
  description: "Generate a new zscripts script file inside the monorepo's scripts/ directory.",
  hint: "Usage: zscripts gen <name> [--force]",
  examples: [
    "zscripts gen hello-world",
    "zscripts gen tools/resize-image",
  ],
  positionals: {
    name: str(),
  },
  flags: {
    force: bool().default(false),
  },
  aliases: {
    f: "force",
  },
  docs: {
    positionals: {
      name: "Script name, e.g. 'hello-world' or 'tools/resize-image'",
    },
    flags: {
      force: "Overwrite existing files if they already exist",
    },
  },
});

export type Args = InferCli<typeof cli>;

function ensureTs(name: string): string {
  return name.endsWith(".ts") ? name : `${name}.ts`;
}

function stripLeadingSlash(p: string): string {
  return p.replace(/^\/+/, "");
}

function isInside(base: string, target: string): boolean {
  const rel = path.relative(base, target);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

async function writeFileSafe(
  filePath: string,
  content: string,
  force: boolean
) {
  try {
    if (!force) {
      const stat = await Deno.stat(filePath).catch(() => undefined);
      if (stat && stat.isFile) {
        throw new Error(
          `Refusing to overwrite existing file: ${filePath} (use --force)`
        );
      }
    }
    await Deno.mkdir(path.dirname(filePath), { recursive: true });
    await Deno.writeTextFile(filePath, content);
  } catch (e) {
    throw e;
  }
}

function buildTypedTemplate(importPathToCoreCli: string, scriptName: string) {
  return `import { defineCliSimple, str, num, bool, type InferCli } from "${importPathToCoreCli}";

export const cli = defineCliSimple({
  description: "Describe what ${scriptName} does.",
  hint: "Usage: zscripts ${scriptName} <input> [--count=1]",
  examples: [
    "zscripts ${scriptName} foo",
    "zscripts ${scriptName} foo --count=3",
  ],
  positionals: {
    input: str(),
  },
  flags: {
    count: num().default(1),
    verbose: bool().default(false),
  },
  aliases: { c: "count", v: "verbose" },
  docs: {
    positionals: { input: "Primary input" },
    flags: { count: "Number of times", verbose: "Enable verbose logging" },
  },
});

export type Args = InferCli<typeof cli>;

export async function run(args: Args) {
  if (args.verbose) console.log("Running ${scriptName}...");
  console.log({ input: args.input, count: args.count });
}
`;
}

export async function run(args: Args) {
  // Resolve repo root relative to this file location (not CWD)
  const thisFile = path.fromFileUrl(import.meta.url);
  const thisDir = path.dirname(thisFile); // .../core/scripts
  const repoRoot = path.resolve(thisDir, "../../");
  const scriptsDir = path.join(repoRoot, "scripts");

  const rawName = stripLeadingSlash(args.name);
  const nameWithExt = ensureTs(rawName);

  // Target path under scripts/
  const targetPath = path.join(scriptsDir, nameWithExt);

  // Safety: ensure targetPath is inside scriptsDir
  if (!isInside(scriptsDir, targetPath)) {
    console.error(`Refusing to write outside scripts/: ${targetPath}`);
    return;
  }

  // Compute import path to core/cli.ts relative to target file
  const coreCliAbs = path.join(repoRoot, "core/cli.ts");
  const targetDir = path.dirname(targetPath);
  let importRel = path.relative(targetDir, coreCliAbs);
  if (!importRel.startsWith(".")) importRel = `./${importRel}`;

  // Build file contents
  const scriptRoute = nameWithExt.replace(/\.ts$/, "");
  const content = buildTypedTemplate(importRel, scriptRoute);

  try {
    await writeFileSafe(targetPath, content, args.force);
    console.log(`Created ${targetPath}`);
  } catch (e) {
    console.error(e?.message ?? e);
  }
}

