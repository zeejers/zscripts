import path from "node:path";

const entryPoint = Deno.args?.[0];
let params: string[] = [];

if (Deno.args.length > 0) {
  params = Deno.args.slice(1);
}
async function runCmd(_entryPoint: string, params: string[]) {
  const entryPoint = _entryPoint || "list";
  console.log(
    ">> HELP: No entrypoint script was provided. These are the scripts that are available. <<\n"
  );
  try {
    const entryPointPath = path.join(
      import.meta.dirname || "./",
      `scripts/${entryPoint}.ts`
    );
    const module = await import(entryPointPath);

    // Check if the module exports a default function or a specific named function
    if (typeof module.default === "function") {
      // Call the default exported function with parameters
      await module.default(params);
    } else if (typeof module.run === "function") {
      // Alternatively, call a named function 'run' if it exists
      await module.run(params);
    } else {
      //  Execution occurs automatically on import
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
