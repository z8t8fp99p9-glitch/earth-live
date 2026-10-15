import { existsSync, readFileSync } from "node:fs";

const required = [
  "index.html",
  "style.css",
  "app.js",
  "app-version.js",
  "manifest.webmanifest",
  "service-worker.js",
  "icon.svg"
];

let failed = false;
for (const file of required) {
  if (existsSync(file)) console.log(`PASS: ${file} exists`);
  else {
    console.error(`FAIL: ${file} is missing`);
    failed = true;
  }
}

for (const file of ["app.js", "service-worker.js"]) {
  if (existsSync(file) && readFileSync(file, "utf8").trim()) {
    console.log(`PASS: ${file} is not empty`);
  } else {
    console.error(`FAIL: ${file} is empty`);
    failed = true;
  }
}

const html = existsSync("index.html") ? readFileSync("index.html", "utf8") : "";
for (const requiredRef of ["./style.css", "./app.js", "./manifest.webmanifest"]) {
  if (!html.includes(requiredRef)) {
    console.error(`FAIL: index.html does not reference ${requiredRef}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("Basic-globe release checks passed.");
