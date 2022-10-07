# setup-swiftwasm

A GitHub Action that downloads a SwiftWasm toolchain and adds it to the `PATH`.


## Usage

To run the action with the latest SwiftWasm toolchain, add the following to your workflow file:

```yaml
- uses: swiftwasm/setup-swiftwasm@v1
- run: swift --version # `swift` command in SwiftWasm
```

A specific toolchain version can be specified with the `swift-version` input:

```yaml
- uses: swiftwasm/setup-swiftwasm@v1
  with:
    swift-version: "wasm-5.6.0-RELEASE"
```

You can also specify nightly toolchains:

```yaml
- uses: swiftwasm/setup-swiftwasm@v1
  with:
    swift-version: "wasm-DEVELOPMENT-SNAPSHOT-2022-10-04-a"
```

You can find the list of available toolchain versions on the [SwiftWasm Releases page](https://github.com/swiftwasm/swift/releases).

## Supported Platforms

The action currently supports macOS and Ubuntu runners.
