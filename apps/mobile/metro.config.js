const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
// `apps/web` pulls React 19, which leaves nested copies of React 19 inside
// hoisted packages like `@trpc/react-query`. Without this flag, Metro resolves
// React via the nested copy and the bundle ends up with two Reacts — every
// hook call throws "Invalid hook call".
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
