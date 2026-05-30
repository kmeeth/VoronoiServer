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
// pnpm hoists React but leaves nested copies inside packages with React as a
// peer dep (e.g. `@trpc/react-query/node_modules/react`). Without this flag,
// Metro picks up the nested copy and the bundle ships two Reacts — every hook
// call throws "Invalid hook call". Forces Metro to resolve only from the
// listed roots.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
