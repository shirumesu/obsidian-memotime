const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;

function parseSemver(version, label = "version") {
  const match = SEMVER_PATTERN.exec(String(version).trim());
  if (!match) {
    throw new Error(`${label} must be a semantic version like 0.5.0. Received: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    normalized: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

function compareSemver(leftVersion, rightVersion) {
  const left = parseSemver(leftVersion, "left version");
  const right = parseSemver(rightVersion, "right version");

  if (left.major !== right.major) {
    return left.major - right.major;
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  return left.patch - right.patch;
}

function resolveReleaseVersion({
  manifestVersion,
  packageVersion,
  manualVersion,
  versionsMap,
  minAppVersion,
}) {
  const manifest = parseSemver(manifestVersion, "manifest.json version").normalized;
  const pkg = parseSemver(packageVersion, "package.json version").normalized;

  if (manifest !== pkg) {
    throw new Error(
      `manifest.json version ${manifest} does not match package.json version ${pkg}.`,
    );
  }

  const manual = manualVersion ? parseSemver(manualVersion, "manual version").normalized : "";
  if (manual && manual !== manifest) {
    throw new Error(
      `Manual version ${manual} does not match the repository version ${manifest}.`,
    );
  }

  if (!Object.prototype.hasOwnProperty.call(versionsMap, manifest)) {
    throw new Error(`versions.json is missing version ${manifest}.`);
  }

  if (versionsMap[manifest] !== minAppVersion) {
    throw new Error(
      `versions.json entry for ${manifest} must match manifest.json minAppVersion ${minAppVersion}.`,
    );
  }

  return manifest;
}

function determineReleaseDecision({ version, latestVersion }) {
  const current = parseSemver(version);
  if (current.patch !== 0) {
    return {
      shouldRelease: false,
      reason: `Version ${current.normalized} is not eligible: patch releases are skipped.`,
    };
  }

  if (latestVersion) {
    const latest = parseSemver(latestVersion, "latest release version").normalized;
    if (compareSemver(current.normalized, latest) <= 0) {
      return {
        shouldRelease: false,
        reason: `Version ${current.normalized} is not newer than the latest release ${latest}.`,
      };
    }
  }

  return {
    shouldRelease: true,
    reason: `Version ${current.normalized} is eligible for release.`,
  };
}

function normalizeTagVersion(tagName) {
  const match = SEMVER_PATTERN.exec(String(tagName).trim());
  if (!match) {
    return null;
  }

  return `${match[1]}.${match[2]}.${match[3]}`;
}

// Tags may include unrelated names. Keep only semantic versions and return the highest one.
function findLatestTaggedVersion(tags) {
  return tags
    .map(normalizeTagVersion)
    .filter(Boolean)
    .sort((left, right) => compareSemver(right, left))[0] ?? "";
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getGitTags(cwd) {
  const output = execFileSync("git", ["tag", "--list"], {
    cwd,
    encoding: "utf8",
  });

  return output
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function writeGitHubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, "utf8");
}

function main() {
  const repoRoot = process.cwd();
  const manifest = readJson(path.join(repoRoot, "manifest.json"));
  const packageJson = readJson(path.join(repoRoot, "package.json"));
  const versionsMap = readJson(path.join(repoRoot, "versions.json"));

  const releaseVersion = resolveReleaseVersion({
    manifestVersion: manifest.version,
    packageVersion: packageJson.version,
    manualVersion: process.env.RELEASE_VERSION_INPUT || "",
    versionsMap,
    minAppVersion: manifest.minAppVersion,
  });

  const latestVersion = findLatestTaggedVersion(getGitTags(repoRoot));
  const decision = determineReleaseDecision({
    version: releaseVersion,
    latestVersion,
  });

  const packageDir = packageJson.name || manifest.id;
  const zipName = `${packageDir}-${releaseVersion}.zip`;

  writeGitHubOutput("release_version", releaseVersion);
  writeGitHubOutput("release_tag", releaseVersion);
  writeGitHubOutput("latest_release_version", latestVersion);
  writeGitHubOutput("should_release", decision.shouldRelease ? "true" : "false");
  writeGitHubOutput("release_reason", decision.reason);
  writeGitHubOutput("package_dir", packageDir);
  writeGitHubOutput("zip_name", zipName);

  console.log(decision.reason);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  compareSemver,
  determineReleaseDecision,
  findLatestTaggedVersion,
  normalizeTagVersion,
  parseSemver,
  resolveReleaseVersion,
};
