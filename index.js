const fs = require("fs");
const core = require("@actions/core");
const tc = require("@actions/tool-cache");
const os = require("os");
const path = require("path");

const defaultSwiftVersion = "wasm-5.8.0-RELEASE";

async function run(version) {
  validateVersion(version);
  const platform = resolveHostPlatform();
  const url = toolchainDownloadUrl(version, platform);
  core.debug(`Resolved toolchain download URL: ${url}`);
  const toolchainPath = await installToolchain(url, version, platform);
  core.info(`Toolchain installed at ${toolchainPath}`);
  core.addPath(`${toolchainPath}/usr/bin`);
  core.setOutput("toolchain-path", toolchainPath);
}

async function installToolchain(url, version, platform) {
  const cachePath = tc.find("swiftwasm", version, platform.arch);
  if (cachePath) {
    core.info("Toolchain already installed.");
    return cachePath;
  }
  core.info(`Downloading tool from ${url}`);
  const downloadPath = await tc.downloadTool(url);
  core.debug(`Installing toolchain from ${downloadPath}`);
  let toolchainPath;
  switch (platform.pkg) {
    case "tar.gz": {
      const extractedPath = await tc.extractTar(downloadPath);
      toolchainPath = path.join(extractedPath, `swift-${version}`);
      break;
    }
    case "pkg": {
      const extractedPath = await tc.extractXar(downloadPath);
      toolchainPath = await tc.extractTar(path.join(extractedPath, "Payload"));
      break;
    }
    default:
      throw new Error(`Unsupported package type: ${platform.pkg}`);
  }
  core.debug(`Installed toolchain to ${toolchainPath}`);
  const cachedPath = await tc.cacheDir(toolchainPath, "swiftwasm", version, platform.arch);
  return cachedPath;
}

function resolveVersionInput() {
  const version = core.getInput('swift-version');
  if (version) {
    core.debug(`Using version from input: ${version}`);
    return version;
  }
  if (fs.existsSync(".swift-version")) {
    const versionFile = fs.readFileSync('.swift-version', 'utf8').trim();
    if (versionFile !== "") {
      core.debug(`Using version from .swift-version file: ${versionFile}`);
      return versionFile;
    }
  }
  core.debug(`Using version from default: ${defaultSwiftVersion}`);
  return defaultSwiftVersion;
}

function validateVersion(version) {
  if (version === "") {
    throw new Error("Empty version specified.");
  }
  if (!version.startsWith("wasm-")) {
    throw new Error(`Invalid version specified: ${version}. Version must start with 'wasm-'. For example: '${defaultSwiftVersion}'`);
  }
}

function resolveHostPlatform() {
  function normalizeOS(platform) {
    switch (platform) {
      case "linux":
        return "linux";
      case "darwin":
        return "macos";
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  function normalizeArch(arch) {
    switch (arch) {
      case "arm64":
        return "arm64";
      case "x64":
        return "x86_64";
      default:
        throw new Error(`Unsupported architecture: ${arch}`);
    }
  }

  function parseOSRelease() {
    const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
    const lines = osRelease.split(os.EOL);
    const osReleaseMap = {};
    for (const line of lines) {
      const [key, value] = line.split('=');
      if (key && value) {
        osReleaseMap[key] = value.replace(/["]/g, "");
      }
    }
    return osReleaseMap;
  }

  const platform = normalizeOS(os.platform());
  if (platform === "linux") {
    const osRelease = parseOSRelease();
    if (osRelease.ID === "ubuntu") {
      const arch = normalizeArch(os.arch());
      return { suffix: `ubuntu${osRelease.VERSION_ID}_${arch}`, pkg: "tar.gz", arch };
    } else if (osRelease.ID === "amzn") {
      if (osRelease.VERSION_ID === "2") {
        const arch = normalizeArch(os.arch());
        return { suffix: `amazonlinux2_${arch}`, pkg: "tar.gz", arch };
      }
    }
    throw new Error(`Unsupported Linux distribution: ${osRelease.ID} ${osRelease.VERSION_ID}`);
  } else if (platform === "macos") {
    const arch = normalizeArch(os.arch());
    return { suffix: `macos_${arch}`, pkg: "pkg", arch };
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}

function toolchainDownloadUrl(version, platform) {
  return `https://github.com/swiftwasm/swift/releases/download/swift-${version}/swift-${version}-${platform.suffix}.${platform.pkg}`;
}

module.exports = { run, resolveVersionInput };
