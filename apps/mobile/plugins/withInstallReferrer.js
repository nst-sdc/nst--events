/**
 * DEPRECATED: Previously injected InstallReferrerPackage into MainApplication.kt and build.gradle.
 * Install Referrer attribution is now provided via the tracked CNG-compatible local Expo module:
 * `apps/mobile/modules/install-referrer` which is automatically autolinked by Expo Prebuild.
 */
module.exports = function withInstallReferrer(config) {
  return config;
};
