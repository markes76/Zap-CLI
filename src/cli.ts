#!/usr/bin/env node
import { runCli } from "./app.js";

const emitWarning = process.emitWarning.bind(process) as (...args: unknown[]) => void;
process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  const message = typeof warning === "string" ? warning : warning.message;
  const type = typeof args[0] === "string" ? args[0] : undefined;
  if (type === "ExperimentalWarning" && message.includes("SQLite")) {
    return;
  }
  emitWarning(warning, ...args);
}) as typeof process.emitWarning;

process.on("warning", (warning) => {
  if (warning.name === "ExperimentalWarning" && warning.message.includes("SQLite")) {
    return;
  }
  process.stderr.write(`${warning.name}: ${warning.message}\n`);
});

const result = await runCli(process.argv.slice(2));

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

process.exitCode = result.exitCode;
