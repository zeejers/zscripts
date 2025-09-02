import path from "node:path";

// Typed CLI support and per-script hints
// - zscripts <script> --help | help | hint: show per-script help/hint
// - zscripts hint <script>: same as above
// - If a script exports `cli` from core/cli.ts, use it to parse args and print help

const entryPoint = Deno.args?.[0];
let params: string[] = [];
if (Deno.args.length > 0) params = Deno.args.slice(1);

function isCoreScript(name: string) {
  return name === "list" || name === "gen" || name === "example";
}
function resolveScriptPath(name: string) {
  const corePath = isCoreScript(name) ? "core/" : "";
  return path.join(
    import.meta.dirname || "./",
    `scripts/${corePath}${name}.ts`
  );
}

function printGeneralHelp() {
  console.log(
    [
      "zscripts <script> [args] [options]",
      "",
      "Examples:",
      "  zscripts list",
      "  zscripts gen <script>",
      "  zscripts <script> --help",
      "  zscripts hint <script>",
      "",
      "Tip: Export a 'cli' from your script using core/cli.ts to auto-generate help",
      "",
    ].join("\n")
  );
}

async function showScriptHelp(name: string) {
  // Try meta-only module first: scripts/<name>.meta.ts (optional)
  try {
    const metaPath = path.join(
      import.meta.dirname || "./",
      `scripts/${name}.meta.ts`
    );
    const metaModule = await import(metaPath);
    const cli = metaModule.cli ?? undefined;
    const meta = cli?.meta ?? metaModule.meta;
    if (cli?.helpText) {
      console.log(cli.helpText(name));
      return;
    }
    if (meta?.hint || meta?.description) {
      console.log([meta.description, meta.hint].filter(Boolean).join("\n\n"));
      return;
    }
  } catch (_) {
    // ignore
  }
  // Fallback: import the script itself and look for exports (may run TLA)
  try {
    const module = await import(resolveScriptPath(name));
    const cli = module.cli ?? undefined;
    const meta = cli?.meta ?? module.meta;
    if (cli?.helpText) {
      console.log(cli.helpText(name));
      return;
    }
    if (meta?.hint || meta?.description) {
      console.log([meta.description, meta.hint].filter(Boolean).join("\n\n"));
      return;
    }
  } catch (_) {
    // final fallback below
  }
  console.log(
    `No help/hint found for script '${name}'. Export a 'cli' using core/cli.ts to enable help.`
  );
}

async function runCmd(_entryPoint: string | undefined, params: string[]) {
  // Support top-level help without script
  if (
    !_entryPoint ||
    _entryPoint === "--help" ||
    _entryPoint === "-h" ||
    _entryPoint === "help"
  ) {
    // default to list, but print a one-liner
    return printGeneralHelp();
  }

  // Dedicated "hint" subcommand: zscripts hint <script>
  if (_entryPoint === "hint") {
    const scriptName = params?.[0];
    if (!scriptName) {
      console.error("Usage: zscripts hint <script>");
      return;
    }
    await showScriptHelp(scriptName);
    return;
  }

  const entryPoint = _entryPoint;
  const wantsHelp =
    params.includes("--help") || params.includes("-h") || params[0] === "help";
  if (wantsHelp) {
    await showScriptHelp(entryPoint);
    return;
  }

  try {
    const entryPointPath = resolveScriptPath(entryPoint);
    const module = await import(entryPointPath);

    // If module exports a cli, parse typed args first
    const cli = module.cli ?? undefined;
    if (cli && typeof module.run === "function") {
      try {
        const parsed = cli.parse(params);
        await module.run(parsed);
      } catch (e) {
        console.error(e?.message ?? e);
        try {
          // Show help if available to guide the user
          console.log("\n" + cli.helpText(entryPoint));
        } catch (_) {
          // ignore
        }
      }
      return;
    }

    // Check if the module exports a default function or a specific named function
    if (typeof module.default === "function") {
      await module.default(params);
    } else if (typeof module.run === "function") {
      await module.run(params);
    } else {
      // Execution occurs automatically on import (e.g., scripts with top-level code)
    }
  } catch (err) {
    const notFoundMatchPattern = /.*Module not found.*/gi;
    if (err instanceof TypeError && notFoundMatchPattern.test(err?.message)) {
      console.error(`Entrypoint ${entryPoint} not found in scripts`);
    } else {
      console.error(err);
    }
  }
}

await runCmd(entryPoint, params);
