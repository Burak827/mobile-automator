import { spawn } from "node:child_process";

const cliArgs = process.argv.slice(2);

function exitWithChildCode(code, signal) {
  if (typeof code === "number") {
    process.exit(code);
    return;
  }
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(1);
}

function runCliMode(args) {
  const child = spawn("tsx", ["src/index.ts", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("exit", (code, signal) => {
    exitWithChildCode(code, signal);
  });

  child.on("error", (error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start CLI process:", error);
    process.exit(1);
  });
}

function runWebDevMode() {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const children = [
    spawn(npmCmd, ["run", "web:api"], { stdio: "inherit" }),
    spawn(npmCmd, ["run", "web:ui:dev"], { stdio: "inherit" }),
  ];

  let isShuttingDown = false;

  const shutdown = (signal = "SIGTERM") => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    for (const child of children) {
      if (!child.killed) {
        child.kill(signal);
      }
    }
  };

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      shutdown(signal);
    });
  }

  for (const child of children) {
    child.on("error", (error) => {
      // eslint-disable-next-line no-console
      console.error("Failed to start dev subprocess:", error);
      shutdown("SIGTERM");
      process.exit(1);
    });

    child.on("exit", (code, signal) => {
      if (!isShuttingDown) {
        shutdown("SIGTERM");
      }
      exitWithChildCode(code, signal);
    });
  }
}

if (cliArgs.length > 0) {
  runCliMode(cliArgs);
} else {
  runWebDevMode();
}
