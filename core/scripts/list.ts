import * as path from "jsr:@std/path";

export async function run() {
  // Determine repo structure relative to this file
  const here = path.dirname(path.fromFileUrl(import.meta.url)); // core/scripts
  const repoRoot = path.resolve(here, "../../");
  const userScriptsDir = path.join(repoRoot, "scripts");
  const coreScriptsDir = path.join(repoRoot, "core/scripts");

  async function listDir(dir: string): Promise<string[]> {
    const names: string[] = [];
    try {
      for await (const e of Deno.readDir(dir)) {
        if (e.isFile && e.name.endsWith(".ts")) {
          names.push(path.basename(e.name, ".ts"));
        }
      }
    } catch (_) {
      // ignore missing dir
    }
    return names;
  }

  const [userScripts, coreScripts] = await Promise.all([
    listDir(userScriptsDir),
    listDir(coreScriptsDir),
  ]);

  const all = new Set<string>([...userScripts, ...coreScripts]);
  [...all].sort().forEach((name) => console.log(name));
}

