import path from "node:path";
import { exec } from "node:child_process";
export function run(params: string[]) {
  const inputFile = params?.[0];
  const generatedOutputFile = path.basename(inputFile);
  const ext = path.extname(inputFile);
  const generatedOutputFileNoExt = generatedOutputFile.replace(`${ext}`, "");
  const generateOutputFileName = `${generatedOutputFileNoExt}-converted${ext}`;
  const outputFile = params?.[1] || generateOutputFileName;
  exec(
    `ffmpeg -y -i "${inputFile}" -c:a pcm_mulaw -ar 8000 "${outputFile}"`,
    (err, stdout, stderr) => {
      if (err) {
        console.log(err);
        return;
      }
      if (stderr) {
        console.log(outputFile);

        return;
      }
      console.log(outputFile);

      return;
    }
  );
}
