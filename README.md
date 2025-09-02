# ZSCRIPTS - Lightweight personal monorepo configuration

Your own personal monorepo. Got random helper scripts you like to re-use across projects? Throw them in scripts and call them from anywhere.

The framework provides:
- A simple runner: `zscripts <script> [args]`
- A typed CLI helper: `defineCliSimple` for easy, fully typed args + help
- A generator: `zscripts gen <name>` to scaffold new typed scripts

# SETUP

Install deno (https://docs.deno.com/runtime/getting_started/installation):
```bash
curl -fsSL https://deno.land/install.sh | sh
```

Run this command from the repo root to register `zscripts` command globally
```bash
deno run install
```

Now, test by listing zscripts:
```bash
zscripts list
```

# Authoring scripts (typed, simple API)

Use defineCliSimple from core/cli.ts to declare your args. This gives you:
- IntelliSense for args in your run function
- Generated help output for --help
- Object-shaped positionals (no "as const" needed) and short helpers for common types

Example: scripts/hello-world.ts

```ts
import { defineCliSimple, str, bool, type InferCli } from "../core/cli.ts";

export const cli = defineCliSimple({
  description: "Hello world example",
  hint: "Usage: zscripts hello-world <name> [--shout]",
  examples: [
    "zscripts hello-world Alice",
    "zscripts hello-world Bob --shout",
  ],
  positionals: { name: str() },
  flags: { shout: bool().default(false) },
  aliases: { s: "shout" },
});

export type Args = InferCli<typeof cli>;

export function run(args: Args) {
  const msg = `Hello ${args.name}!`;
  console.log(args.shout ? msg.toUpperCase() : msg);
}
```

Run it:
```bash
zscripts hello-world Alice
zscripts hello-world Bob --shout
```

# Example: Bing search (typed)

scripts/bing-search.ts
```ts
import { defineCliSimple, str, type InferCli } from "../core/cli.ts";

export const cli = defineCliSimple({
  description: "Fetch Bing homepage HTML (optionally with a query)",
  hint: "Usage: zscripts bing-search [query]",
  examples: [
    "zscripts bing-search",
    "zscripts bing-search \"Great apple pie recipes\"",
  ],
  positionals: { query: str().optional() },
});

export type Args = InferCli<typeof cli>;

export async function run(args: Args) {
  const url = new URL("https://bing.com");
  if (args.query) url.searchParams.append("q", args.query);
  const response = await fetch(url.href);
  const text = await response.text();
  console.log(text);
}
```

Run it:
```bash
zscripts bing-search
zscripts bing-search "Great apple pie recipes"
```

# Example: ffmpeg-g711 (typed)

scripts/ffmpeg-g711.ts
```ts
import path from "node:path";
import { exec } from "node:child_process";
import { defineCliSimple, str, num, bool, type InferCli } from "../core/cli.ts";

export const cli = defineCliSimple({
  description: "Convert an audio file to G.711 (mu-law by default) and print the output path.",
  hint: "Usage: zscripts ffmpeg-g711 <input> [output] --rate=8000 --codec=pcm_mulaw",
  examples: [
    "zscripts ffmpeg-g711 ./in.wav",
    "zscripts ffmpeg-g711 ./in.wav ./out.wav",
    "zscripts ffmpeg-g711 ./in.wav --rate=8000 --codec=pcm_mulaw",
  ],
  positionals: { input: str(), output: str().optional() },
  flags: { rate: num().default(8000), codec: str().default("pcm_mulaw"), overwrite: bool().default(true) },
  aliases: { r: "rate", c: "codec", y: "overwrite" },
});

export type Args = InferCli<typeof cli>;

export function run(args: Args) {
  const inputFile = args.input;
  const ext = path.extname(inputFile);
  const base = path.basename(inputFile).replace(`${ext}`, "");
  const outputFile = args.output || `${base}-converted${ext}`;
  const overwrite = args.overwrite ? "-y" : "";
  const cmd = `ffmpeg ${overwrite} -i "${inputFile}" -c:a ${args.codec} -ar ${args.rate} "${outputFile}"`;
  exec(cmd, (_err, _stdout, _stderr) => console.log(outputFile));
}
```

# Help and discovery

- Show help for any script that exports cli:
```bash
zscripts <script> --help
```
- List available scripts:
```bash
zscripts list
```

# Scaffolding new scripts

Use the built-in generator (writes relative to this repo, not your CWD):
```bash
zscripts gen my-script
zscripts gen tools/resize-image
zscripts gen my-script --force  # overwrite if exists
```

# Notes
- Prefer num()/str()/bool() helpers for concise, typed flags and positionals.
- Aliases map short flags to long ones, e.g., { r: "rate" } -> -r 8000.
- Old-style scripts are still supported by the runner for backwards compatibility, but new scripts should use defineCliSimple.
- If a script also exports meta or a separate `scripts/<name>.meta.ts`, the runner will use that for help text where available.
- Secrets: don’t echo secrets in commands; use environment variables instead.
- Deno permissions: the installed zscripts command uses --allow-all for convenience. Consider tightening if you need stricter policies.
