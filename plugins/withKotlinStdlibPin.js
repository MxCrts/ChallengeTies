const {
  withProjectBuildGradle,
  withSettingsGradle,
} = require("@expo/config-plugins");

const KOTLIN = "2.2.10";
const TAG = "TIES_KOTLIN_222";

function patchProjectBuildGradle(src) {
  if (src.includes(TAG)) return src;

  // 1) force ext.kotlinVersion
  if (src.match(/kotlinVersion\s*=\s*["'][^"']+["']/)) {
    src = src.replace(
      /kotlinVersion\s*=\s*["'][^"']+["']/,
      `kotlinVersion = "${KOTLIN}" // ${TAG}`
    );
  } else if (src.includes("ext {")) {
    src = src.replace(
      "ext {",
      `ext {\n  kotlinVersion = "${KOTLIN}" // ${TAG}`
    );
  } else {
    src += `\n\next {\n  kotlinVersion = "${KOTLIN}" // ${TAG}\n}\n`;
  }

  // 2) force kotlin-gradle-plugin to use kotlinVersion
  // - remplace si hardcodé
  src = src.replace(
    /classpath\(["']org\.jetbrains\.kotlin:kotlin-gradle-plugin:[^"']+["']\)/g,
    `classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")`
  );

  // - si présent sans version variable, on ne touche pas
  // - si absent totalement, on n’injecte pas ici (expo met souvent déjà la ligne)

  if (!src.includes(TAG)) src += `\n// ${TAG}\n`;
  return src;
}

function patchSettingsGradle(src) {
  // Patch les versions Kotlin déclarées via pluginManagement / plugins DSL
  // Cas 1: plugins { id("org.jetbrains.kotlin.android") version "2.0.x" }
  src = src.replace(
    /(id\(["']org\.jetbrains\.kotlin\.android["']\)\s*version\s*["'])2\.[0-9.]+(["'])/g,
    `$1${KOTLIN}$2`
  );
  src = src.replace(
    /(id\(["']org\.jetbrains\.kotlin\.jvm["']\)\s*version\s*["'])2\.[0-9.]+(["'])/g,
    `$1${KOTLIN}$2`
  );

  // Cas 2: kotlin("android") version "2.0.x"
  src = src.replace(
    /(kotlin\(["']android["']\)\s*version\s*["'])2\.[0-9.]+(["'])/g,
    `$1${KOTLIN}$2`
  );
  src = src.replace(
    /(kotlin\(["']jvm["']\)\s*version\s*["'])2\.[0-9.]+(["'])/g,
    `$1${KOTLIN}$2`
  );

  // Ajoute un tag si on a modifié quelque chose
  if (!src.includes(TAG)) src += `\n// ${TAG}\n`;
  return src;
}

module.exports = function withKotlinStdlibPin(config) {
  config = withProjectBuildGradle(config, (cfg) => {
    cfg.modResults.contents = patchProjectBuildGradle(cfg.modResults.contents);
    return cfg;
  });

  config = withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = patchSettingsGradle(cfg.modResults.contents);
    return cfg;
  });

  return config;
};
