import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parsePackageVersion } from "../src/main.js";

const MAIN_PATH = join(import.meta.dirname, "..", "src", "main.js");

const EMPTY_OUTPUTS = {
  name: "",
  version: "",
  major: "",
  minor: "",
  patch: "",
  prerelease: "",
  build: "",
};

function runAction({ packageInput, safeParse, githubActions = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "gha-package-version-parser-"));
  const outputPath = join(directory, "github_output");
  writeFileSync(outputPath, "");

  const env = { ...process.env, GITHUB_OUTPUT: outputPath };
  delete env.GITHUB_ACTIONS;
  delete env.INPUT_PACKAGE;
  delete env["INPUT_SAFE-PARSE"];
  if (packageInput !== undefined) {
    env.INPUT_PACKAGE = packageInput;
  }
  if (safeParse !== undefined) {
    env["INPUT_SAFE-PARSE"] = String(safeParse);
  }
  if (githubActions) {
    env.GITHUB_ACTIONS = "true";
  }

  const result = spawnSync(process.execPath, [MAIN_PATH], {
    env,
    encoding: "utf8",
  });

  const outputs = {};
  for (const line of readFileSync(outputPath, "utf8").split("\n")) {
    if (line === "") {
      continue;
    }
    const separator = line.indexOf("=");
    outputs[line.slice(0, separator)] = line.slice(separator + 1);
  }

  rmSync(directory, { recursive: true, force: true });
  return { status: result.status, stdout: result.stdout, outputs };
}

test("README の入出力例: 名前なし・v 接頭辞・* 指定", () => {
  const expected = {
    name: "*",
    version: "1.2.3",
    major: "1",
    minor: "2",
    patch: "3",
    prerelease: "",
    build: "",
  };
  for (const input of ["1.2.3", "v1.2.3", "*@1.2.3", "*@v1.2.3"]) {
    assert.deepEqual(parsePackageVersion(input), expected, input);
  }
});

test("README の入出力例: 名前・プレリリース・ビルドメタデータ", () => {
  const expected = {
    name: "my-package",
    version: "1.2.3-alpha.1",
    major: "1",
    minor: "2",
    patch: "3",
    prerelease: "alpha.1",
    build: "build.123",
  };
  for (const input of [
    "my-package@1.2.3-alpha.1+build.123",
    "my-package@v1.2.3-alpha.1+build.123",
  ]) {
    assert.deepEqual(parsePackageVersion(input), expected, input);
  }
});

test("スコープ付きパッケージ名を解析する", () => {
  assert.deepEqual(parsePackageVersion("@scope/my-package@1.2.3"), {
    name: "@scope/my-package",
    version: "1.2.3",
    major: "1",
    minor: "2",
    patch: "3",
    prerelease: "",
    build: "",
  });
});

test("ビルドメタデータのみの場合も解析する", () => {
  assert.deepEqual(parsePackageVersion("1.2.3+build.1"), {
    name: "*",
    version: "1.2.3",
    major: "1",
    minor: "2",
    patch: "3",
    prerelease: "",
    build: "build.1",
  });
});

test("前後の空白は無視する", () => {
  assert.deepEqual(parsePackageVersion(" 1.2.3 "), {
    name: "*",
    version: "1.2.3",
    major: "1",
    minor: "2",
    patch: "3",
    prerelease: "",
    build: "",
  });
});

test("無効な文字列は null を返す", () => {
  const invalid = [
    "",
    " ",
    "1.2",
    "1.2.3.4",
    "v",
    "V1.2.3",
    "01.2.3",
    "1.02.3",
    "1.2.03",
    "1.2.3-01",
    "1.2.3-",
    "1.2.3+",
    "1.2.3-alpha..1",
    "@1.2.3",
    "my-package",
    "not-a-version",
  ];
  for (const input of invalid) {
    assert.equal(parsePackageVersion(input), null, JSON.stringify(input));
  }
});

test("有効な入力で各出力を書き出す", () => {
  const result = runAction({
    packageInput: "my-package@v1.2.3-alpha.1+build.123",
  });
  assert.equal(result.status, 0);
  assert.deepEqual(result.outputs, {
    name: "my-package",
    version: "1.2.3-alpha.1",
    major: "1",
    minor: "2",
    patch: "3",
    prerelease: "alpha.1",
    build: "build.123",
  });
  assert.equal(
    result.stdout,
    [
      "name=my-package",
      "version=1.2.3-alpha.1",
      "major=1",
      "minor=2",
      "patch=3",
      "prerelease=alpha.1",
      "build=build.123",
      "",
    ].join("\n"),
  );
});

test("safe-parse が true なら無効入力でも空文字を出力して成功する", () => {
  const result = runAction({ packageInput: "not-a-version", safeParse: "true" });
  assert.equal(result.status, 0);
  assert.deepEqual(result.outputs, EMPTY_OUTPUTS);
  assert.equal(
    result.stdout,
    Object.keys(EMPTY_OUTPUTS)
      .map((name) => `${name}=`)
      .join("\n") + "\n",
  );
});

test("safe-parse が false なら無効入力で失敗する", () => {
  const result = runAction({
    packageInput: "not-a-version",
    safeParse: "false",
    githubActions: true,
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^::error::/u);
  assert.deepEqual(result.outputs, {});
});

test("入力が無い場合は失敗する", () => {
  const result = runAction({ githubActions: true });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^::error::/u);
  assert.deepEqual(result.outputs, {});
});
