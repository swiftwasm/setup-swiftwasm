# setup-swiftwasm

A GitHub Action that installs a Swift SDK for WebAssembly.

## Requirements

This action requires a runner with Swift installed.

## Usage

```yaml
runs-on: ubuntu-latest
container: swift:6.0.3
steps:
  - uses: swiftwasm/setup-swiftwasm@v2
  - run: swift build --swift-sdk wasm32-unknown-wasi
```

To install a Swift SDK compatible with a specific Swift version, add the following to your workflow file:

```yaml
- uses: swiftwasm/setup-swiftwasm@v2
  with:
    tag: "swift-DEVELOPMENT-SNAPSHOT-2025-02-26-a"
```

To install a Swift SDK for other targets, add the following to your workflow file:

```yaml
- uses: swiftwasm/setup-swiftwasm@v2
  with:
    target: "wasm32-unknown-wasip1-threads"
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `tag` | The version of `swift` found in the PATH. | The tag name of swiftlang/swift repository to download the Swift SDK compatible with. |
| `target` | `wasm32-unknown-wasi` | The target to install the Swift SDK for. |

## Outputs

| Output | Description |
|-------|-------------|
| `swift-sdk-id` | The ID of the installed Swift SDK. You can pass this to `--swift-sdk` option of `swift build` command. |
