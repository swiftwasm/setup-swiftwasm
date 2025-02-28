import core from "@actions/core";
import exec from "@actions/exec";
import os from "os";

export async function run() {
  const tag = core.getInput("tag") || await tagFromSwiftVersion();
  const swiftSDKInfo = await swiftSDKInfoFromTag(tag);
  const target = core.getInput("target");
  const sdk = swiftSDKInfo["swift-sdks"][target];
  await installSwiftSDK(sdk.url, sdk.checksum);
}

/** @returns {Promise<string>} */
async function tagFromSwiftVersion() {
  core.info("Checking Swift version...");
  const versionOutput = await exec.getExecOutput("swift", ["--version"]);
  if (versionOutput.exitCode !== 0) {
    throw new Error("Failed to check Swift version.");
  }
  const versionFingerprint = versionOutput.stdout.split(os.EOL)[0];
  core.info(`Swift version: ${versionFingerprint}`);

  core.info("Checking SDK index...");
  const tagByVersionUrl = "https://raw.githubusercontent.com/swiftwasm/swift-sdk-index/refs/heads/main/v1/tag-by-version.json";
  const tagByVersion = await (await fetch(tagByVersionUrl)).json();
  const tag = tagByVersion[versionFingerprint];
  if (!tag) {
    throw new Error(`Tag not found for Swift version: ${versionFingerprint}.`);
  }
  return tag;
}

/**
 * @param {string} tag
 * @returns {Promise<{"swift-sdks": { [key: string]: { id: string, url: string, checksum: string }}}>}
 */
async function swiftSDKInfoFromTag(tag) {
  core.info(`Querying SDK index for tag: ${tag}`);
  const buildUrl = `https://raw.githubusercontent.com/swiftwasm/swift-sdk-index/refs/heads/main/v1/builds/${tag}.json`;
  const build = await (await fetch(buildUrl)).json();
  return build;
}

/**
 * @param {string} url
 * @param {string} checksum
 */
async function installSwiftSDK(url, checksum) {
  const args = ["sdk", "install", url, "--checksum", checksum];
  const exitCode = await exec.exec("swift", args);
  if (exitCode !== 0) {
    throw new Error(`Failed to install Swift SDK: ${url}`);
  }
}
