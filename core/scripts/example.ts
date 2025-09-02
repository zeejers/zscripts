import { defineCliSimple, str, num, type InferCli, bool } from "../cli.ts";

export const cli = defineCliSimple({
  description: "Describe what your script does",
  hint: "Usage: zscripts example <input> [--count=<n>]",
  examples: ["zscripts example foo --count=3"],
  positionals: {
    input: str(),
  },
  flags: {
    count: num().optional(),
    verbose: bool().optional(),
  },
  aliases: {
    c: "count",
    v: "verbose",
  },
});

export type Args = InferCli<typeof cli>;

export async function run(args: Args) {
  // Your logic…
  if (args.verbose) {
    console.log("Verbose mode on");
  }
  console.log({ input: args.input, count: args.count });
}

