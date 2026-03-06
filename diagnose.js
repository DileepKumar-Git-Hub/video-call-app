#!/usr/bin/env node
/**
 * NexMeet Diagnostic Tool
 * Run this to check if everything is set up correctly
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0,
};

function log(symbol, message, color = "\x1b[37m") {
  console.log(`${color}${symbol}\x1b[0m ${message}`);
}

function pass(msg) {
  checks.passed++;
  log("✅", msg, "\x1b[32m");
}

function fail(msg) {
  checks.failed++;
  log("❌", msg, "\x1b[31m");
}

function warn(msg) {
  checks.warnings++;
  log("⚠️ ", msg, "\x1b[33m");
}

function info(msg) {
  log("ℹ️ ", msg, "\x1b[36m");
}

console.log("\n========================================");
console.log("🔧 NexMeet Diagnostic Tool");
console.log("========================================\n");

// Check 1: Files exist
info("Checking required files...");
const requiredFiles = [
  { path: "package.json", desc: "Package config" },
  { path: "server.js", desc: "Backend server" },
  { path: "public/index.html", desc: "Landing page" },
  { path: "public/room.html", desc: "Room page" },
  { path: "public/style.css", desc: "Stylesheet" },
  { path: "public/landing.js", desc: "Landing script" },
  { path: "public/room.js", desc: "Room script" },
];

requiredFiles.forEach(({ path: filePath, desc }) => {
  if (fs.existsSync(filePath)) {
    const size = fs.statSync(filePath).size;
    pass(`${desc} (${(size / 1024).toFixed(1)}KB)`);
  } else {
    fail(`${desc} not found`);
  }
});

// Check 2: Package dependencies
info("\nChecking npm packages...");
const packageJson = require("./package.json");
const requiredDeps = ["express", "socket.io", "uuid"];

requiredDeps.forEach((dep) => {
  if (packageJson.dependencies[dep]) {
    pass(`${dep} (${packageJson.dependencies[dep]})`);
  } else {
    fail(`${dep} not found in dependencies`);
  }
});

// Check 3: Node.js version
info("\nChecking Node.js...");
const nodeVersion = process.version;
const major = parseInt(nodeVersion.split(".")[0].slice(1));
if (major >= 12) {
  pass(`Node.js ${nodeVersion} (${major >= 14 ? "optimal" : "minimum"})`);
} else {
  fail(`Node.js ${nodeVersion} (need v12+)`);
}

// Check 4: Port availability
info("\nChecking port 3001...");
const server = http.createServer();
server.listen(3001, () => {
  pass("Port 3001 is available");
  server.close();

  // Check 5: File sizes
  info("\nChecking file sizes...");
  const cssSize = fs.statSync("public/style.css").size;
  const jsSize = fs.statSync("public/room.js").size;

  if (cssSize > 50000) {
    pass(`CSS is complete (${(cssSize / 1024).toFixed(1)}KB)`);
  } else {
    warn(`CSS might be incomplete (${(cssSize / 1024).toFixed(1)}KB)`);
  }

  if (jsSize > 30000) {
    pass(`room.js is complete (${(jsSize / 1024).toFixed(1)}KB)`);
  } else {
    warn(`room.js might be incomplete (${(jsSize / 1024).toFixed(1)}KB)`);
  }

  // Check 6: Code quality
  info("\nChecking for common issues...");
  const roomJs = fs.readFileSync("public/room.js", "utf8");
  const roomHtml = fs.readFileSync("public/room.html", "utf8");

  if (roomJs.includes("socket.on") && roomJs.includes("socket.emit")) {
    pass("Socket.io event handlers present");
  } else {
    fail("Socket.io event handlers missing");
  }

  if (roomJs.includes("navigator.mediaDevices.getUserMedia")) {
    pass("Media API calls present");
  } else {
    fail("Media API calls missing");
  }

  if (roomHtml.includes('id="videoGrid"')) {
    pass("Video grid element present");
  } else {
    fail("Video grid element missing");
  }

  // Summary
  console.log("\n========================================");
  console.log("📊 Summary");
  console.log("========================================");
  console.log(`✅ Passed: ${checks.passed}`);
  console.log(`⚠️  Warnings: ${checks.warnings}`);
  console.log(`❌ Failed: ${checks.failed}`);
  console.log("========================================\n");

  if (checks.failed === 0) {
    console.log("✨ Everything looks good! Start the server:\n");
    console.log('  $env:PORT=3001; node server.js\n');
    console.log("Then visit: http://localhost:3001\n");
  } else {
    console.log("⚠️  Please fix the issues above before running.\n");
  }

  process.exit(checks.failed > 0 ? 1 : 0);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    fail("Port 3001 is already in use");
    fail("Kill the process using: taskkill /F /IM node.exe");
  } else {
    fail(`Port error: ${err.message}`);
  }
  process.exit(1);
});
