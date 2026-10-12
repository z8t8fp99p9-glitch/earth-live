
import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "index.html",
  "app.js",
  "icon.svg",
  "manifest.webmanifest",
  "service-worker.js",
];

let failed = false;

for (const file of requiredFiles) {
  if (existsSync(file)) {
    console.log(`PASS: ${file} exists`);
  } else {
    console.error(`FAIL: ${file} is missing`);
    failed = true;
  }
}

const app = readFileSync("app.js", "utf8");

if (app.trim().length > 0) {
  console.log("PASS: app.js is not empty");
} else {
  console.error("FAIL: app.js is empty");
  failed = true;
}

if (failed) process.exit(1);

console.log("All release validation checks passed.");
