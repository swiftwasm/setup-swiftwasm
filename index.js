import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { create as createArtifactClient } from "@actions/artifact";
import fs from "fs/promises";
import os from "os";
import path from "path";

export async function run() {
  const tag = core.getInput("tag") || await tagFromSwiftVersion();
  const swiftSDKInfo = await swiftSDKInfoFromTag(tag);
  const target = core.getInput("target");
  const sdk = swiftSDKInfo["swift-sdks"][target];
  await installSwiftSDK(sdk.url, sdk.checksum);
  core.setOutput("swift-sdk-id", sdk.id);
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
  const options = { ignoreReturnCode: true };
  let result;

  core.info("Enabling core dumps for installer (ulimit -c unlimited)...");
  result = await exec.getExecOutput(
    "bash",
    [
      "-e",
      "-o",
      "pipefail",
      "-c",
      "ulimit -c unlimited; swift \"$@\"",
      "--",
      ...args,
    ],
    options,
  );

  if (result.exitCode !== 0) {
    core.error(`Swift SDK installation failed (exitCode=${result.exitCode ?? "signal"}).`);
    await collectCoreDumps().catch((error) => {
      core.warning(`Failed to collect core dumps: ${error}`);
    });
    throw new Error(`Failed to install Swift SDK: ${url}`);
  }
}

async function collectCoreDumps() {
  const searchRoots = [process.cwd(), "/tmp", "/var/lib/systemd/coredump"];
  const destDir = path.join(process.cwd(), "coredumps");
  await fs.mkdir(destDir, { recursive: true });

  // Try coredumpctl first (systemd may have captured the dump even if we cannot read files directly).
  try {
    const coredumpctlPath = path.join(destDir, "coredumpctl-latest.core");
    const corectlResult = await exec.getExecOutput(
      "bash",
      [
        "-c",
        `coredumpctl --no-pager --quiet dump swift-sdk --output "${coredumpctlPath}"`,
      ],
      { ignoreReturnCode: true },
    );
    if (corectlResult.exitCode === 0) {
      core.info("Captured core via coredumpctl.");
    } else {
      // Remove empty file if created.
      await fs.rm(coredumpctlPath, { force: true });
      core.info("coredumpctl did not return a core for swift-sdk.");
    }
  } catch (error) {
    core.info(`coredumpctl unavailable or failed: ${error}`);
  }

  // Use bash to silence permission errors from systemd-private dirs.
  const findCmd = `find ${searchRoots.map((p) => `'${p}'`).join(" ")} -maxdepth 5 -type f -name 'core*' 2>/dev/null`;
  const findResult = await exec.getExecOutput("bash", ["-c", findCmd], { ignoreReturnCode: true });
  const candidates = findResult.stdout
    .split(os.EOL)
    .map((line) => line.trim())
    .filter(Boolean);

  if (candidates.length === 0) {
    core.warning("No core dump files were found after the crash.");
    return;
  }

  const copied = [];
  for (const src of candidates) {
    let dest = path.join(destDir, path.basename(src));
    let suffix = 1;
    // Avoid overwriting when multiple files share the same basename.
    while (await fileExists(dest)) {
      dest = path.join(destDir, `${path.basename(src)}.${suffix}`);
      suffix += 1;
    }
    await fs.copyFile(src, dest);
    copied.push(dest);
  }

  core.info(`Collected ${copied.length} core dump file(s) to ${destDir}`);

  const artifactClient = createArtifactClient();
  try {
    await artifactClient.uploadArtifact(
      "setup-swiftwasm-coredumps",
      copied,
      process.cwd(),
      { retentionDays: 7, compressionLevel: 5 },
    );
    core.info("Uploaded core dump artifact 'setup-swiftwasm-coredumps'.");
  } catch (error) {
    core.warning(`Uploading core dumps failed: ${error}`);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
