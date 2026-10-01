# gha-package-version-parser

パッケージバージョン文字列を解析する GitHub Action です。

## 使い方

```yml
name: "リリース"
run-name: "v${{ github.event.inputs.version }}"

on:
  workflow_dispatch:
    inputs:
      version:
        description: "バージョン（例:「1.2.3」「my-package@1.2.3」）"
        required: true

jobs:
  publish:
    steps:
      - name: "バージョン解析"
        uses: tai-kun/gha-package-version-parser@v1
        with:
          package: ${{ github.event.inputs.version }}
        id: pkg
```

## 入出力例

- `1.2.3`
- `v1.2.3`
- `*@1.2.3`
- `*@v1.2.3`

```json
{
  "name":       "*",
  "version":    "1.2.3",
  "major":      "1",
  "minor":      "2",
  "patch":      "3",
  "prerelease": "",
  "build":      ""
}
```

- `my-package@1.2.3-alpha.1+build.123`
- `my-package@v1.2.3-alpha.1+build.123`

```json
{
  "name":       "my-package",
  "version":    "1.2.3-alpha.1",
  "major":      "1",
  "minor":      "2",
  "patch":      "3",
  "prerelease": "alpha.1",
  "build":      "build.123"
}
```
