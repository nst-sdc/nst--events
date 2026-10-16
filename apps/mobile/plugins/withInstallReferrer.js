const { withAppBuildGradle, withMainApplication, createRunOncePlugin } = require('expo/config-plugins');

const pkg = { name: 'with-install-referrer', version: '1.0.0' };

/**
 * Injects Google Play Install Referrer dependency into app/build.gradle
 */
function withInstallReferrerGradle(config) {
  return withAppBuildGradle(config, (modConfig) => {
    const buildGradle = modConfig.modResults.contents;
    const dependency = 'implementation("com.android.installreferrer:installreferrer:2.2")';
    if (!buildGradle.includes(dependency)) {
      modConfig.modResults.contents = buildGradle.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${dependency}`
      );
    }
    return modConfig;
  });
}

/**
 * Registers InstallReferrerPackage in MainApplication.kt
 */
function withInstallReferrerMainApplication(config) {
  return withMainApplication(config, (modConfig) => {
    let mainApp = modConfig.modResults.contents;
    const packageAdd = 'add(InstallReferrerPackage())';

    if (!mainApp.includes(packageAdd)) {
      mainApp = mainApp.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        `PackageList(this).packages.apply {\n          ${packageAdd}`
      );
      modConfig.modResults.contents = mainApp;
    }
    return modConfig;
  });
}

function withInstallReferrer(config) {
  config = withInstallReferrerGradle(config);
  config = withInstallReferrerMainApplication(config);
  return config;
}

module.exports = createRunOncePlugin(withInstallReferrer, pkg.name, pkg.version);
