const { run } = require('../index');

// Get the latest release, that starts with "swift-wasm-DEVELOPMENT-SNAPSHOT-" from the swiftwasm/swift repository using GitHub API and paginate the results until we find the latest one.
async function getLatestNightlyVersion() {
  let page = 1;
  let version = null;
  while (!version) {
    const response = await fetch(`https://api.github.com/repos/swiftwasm/swift/releases?per_page=100&page=${page}`);
    const releases = await response.json();
    for (const release of releases) {
      if (release.tag_name.startsWith('swift-wasm-DEVELOPMENT-SNAPSHOT-')) {
        version = release.tag_name;
        break;
      }
    }
    page++;
  }
  return version;
}

getLatestNightlyVersion().then(run);
