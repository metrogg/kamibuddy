// 用 Electron 起一个真实 utilityProcess（= daemon 的运行环境），在里面跑 pdf 提取。
const { app, utilityProcess } = require("electron");
const path = require("path");
app.whenReady().then(() => {
  const child = utilityProcess.fork(path.join(__dirname, "child.mjs"), [], { stdio: "pipe" });
  child.stdout?.on("data", (c) => process.stdout.write(String(c)));
  child.stderr?.on("data", (c) => process.stderr.write(String(c)));
  child.on("message", () => app.quit());
  child.on("exit", () => app.quit());
});
