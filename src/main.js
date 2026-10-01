import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import semver from "semver";

const OUTPUT_NAMES = [
  "name",
  "version",
  "major",
  "minor",
  "patch",
  "prerelease",
  "build",
];

export function parsePackageVersion(input) {
  const value = String(input ?? "").trim();
  if (value === "") {
    return null;
  }

  let name = "*";
  let version = value;
  const separator = value.lastIndexOf("@");
  if (separator !== -1) {
    name = value.slice(0, separator);
    version = value.slice(separator + 1);
    if (name === "") {
      return null;
    }
  }

  const parsed = semver.parse(version);
  if (parsed === null) {
    return null;
  }

  return {
    name,
    version: parsed.version,
    major: String(parsed.major),
    minor: String(parsed.minor),
    patch: String(parsed.patch),
    prerelease: parsed.prerelease.join("."),
    build: parsed.build.join("."),
  };
}

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${name}=${value}\n`);
    return;
  }
  process.stdout.write(`${name}=${value}\n`);
}

function setFailed(message) {
  process.exitCode = 1;
  if (process.env.GITHUB_ACTIONS) {
    process.stdout.write(`::error::${message}\n`);
    return;
  }
  process.stderr.write(`${message}\n`);
}

function run() {
  const input = process.env.INPUT_PACKAGE ?? "";
  const safeParse = /^true$/i.test(process.env["INPUT_SAFE-PARSE"] ?? "false");
  const parsed = parsePackageVersion(input);

  if (parsed === null) {
    if (safeParse) {
      for (const name of OUTPUT_NAMES) {
        setOutput(name, "");
      }
      return;
    }
    setFailed(`Invalid package version string: ${JSON.stringify(input)}`);
    return;
  }

  for (const [name, value] of Object.entries(parsed)) {
    setOutput(name, value);
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run();
}
