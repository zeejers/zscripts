import * as path from "jsr:@std/path";

export function run(args?: string[]) {
  const scriptDir = path.resolve(
    path.dirname(path.fromFileUrl(import.meta.url))
  );

  // Go up one directory level
  const parentDir = path.join(scriptDir, "..");

  const files = Deno.readDirSync(parentDir);
  const results = files.map((f) => f.name);
  results.forEach((f) => {
    const fileNoExt = path.basename(f, ".ts");
    console.log(fileNoExt);
  });
}
