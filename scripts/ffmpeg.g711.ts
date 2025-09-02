import path from "node:path";
import { exec } from "node:child_process";
import { defineCliSimple, str, num, bool, type InferCli } from "../core/cli.ts";

export const cli = defineCliSimple({
  description:
    "Convert an audio file to G.711 (mu-law by default) and print the output path.",
  hint: "Usage: zscripts ffmpeg.g711 <input> [output] --rate=8000 --codec=pcm_mulaw",
  examples: [
    "zscripts ffmpeg.g711 ./in.wav",
    "zscripts ffmpeg.g711 ./in.wav ./out.wav",
    "zscripts ffmpeg.g711 ./in.wav --rate=8000 --codec=pcm_mulaw",
  ],
  positionals: {
    input: str(),
    output: str().optional(),
    token: str(),
  },
  flags: {
    rate: num().default(8000),
    codec: str().default("pcm_mulaw"),
    overwrite: bool().default(true),
  },
  aliases: {
    r: "rate",
    c: "codec",
    y: "overwrite",
  },
  docs: {
    positionals: {
      input: "Input media file path",
      output: "Optional output file path",
    },
  },
});

export type Args = InferCli<typeof cli>;

export function run(args: Args) {
  const inputFile = args.input;
  if (!inputFile) {
    console.error("Missing <input> file. Try: zscripts ffmpeg.g711 --help");
    return;
  }
  const generatedOutputFile = path.basename(inputFile);
  const ext = path.extname(inputFile);
  const generatedOutputFileNoExt = generatedOutputFile.replace(`${ext}`, "");
  const generateOutputFileName = `${generatedOutputFileNoExt}-converted${ext}`;
  const outputFile = args.output || generateOutputFileName;
  const overwriteFlag = args.overwrite ? "-y" : "";
  const cmd = `ffmpeg ${overwriteFlag} -i "${inputFile}" -c:a ${args.codec} -ar ${args.rate} "${outputFile}"`;

  exec(cmd, (err, _stdout, stderr) => {
    if (err) {
      console.log(err);
      return;
    }
    if (stderr) {
      // ffmpeg writes progress to stderr; still print output path
      console.log(outputFile);
      return;
    }
    console.log(outputFile);
  });
}
