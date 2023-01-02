const { run } = require('../index');
const github = require('@actions/github');
const core = require('@actions/core');

// Get the latest release, that starts with "swift-wasm-DEVELOPMENT-SNAPSHOT-" from the swiftwasm/swift repository using GitHub API and paginate the results until we find the latest one.
async function getLatestNightlyVersion() {
  const token = core.getInput('token');
  const octokit = github.getOctokit(token);
  for await (const response of octokit.paginate.iterator("GET /repos/{owner}/{repo}/releases", {
    owner: 'swiftwasm',
    repo: 'swift',
  })) {
    for (const release of response.data) {
      if (release.tag_name.startsWith('swift-wasm-DEVELOPMENT-SNAPSHOT-')) {
        return release.tag_name;
      }
    }
  }
  throw new Error('No nightly release found');
}

getLatestNightlyVersion().then(run);
