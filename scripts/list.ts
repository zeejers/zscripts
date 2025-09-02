import * as path from "jsr:@std/path";
export function run(args?: string[]) {
  const scriptDir = path.resolve(
    path.dirname(path.fromFileUrl(import.meta.url))
  );
  const files = Deno.readDirSync(scriptDir);
  const results = files.map((f) => f.name);
  results.forEach((f) => {
    const fileNoExt = path.basename(f, ".ts");
    console.log(fileNoExt);
  });
}
