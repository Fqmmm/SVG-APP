import { runCli } from "./composition/startCli.js";

await runCli({ args: process.argv.slice(2), input: process.stdin, output: process.stdout });
