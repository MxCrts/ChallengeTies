const { withProjectBuildGradle } = require("@expo/config-plugins");

module.exports = function withKotlinStdlibPin(config) {
  return withProjectBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes("TIES_KOTLIN_STDLIB_PIN")) return cfg;

    const pinBlock = `
        // TIES_KOTLIN_STDLIB_PIN
        configurations.all {
          resolutionStrategy {
            force "org.jetbrains.kotlin:kotlin-stdlib:2.0.21"
            force "org.jetbrains.kotlin:kotlin-stdlib-jdk7:2.0.21"
            force "org.jetbrains.kotlin:kotlin-stdlib-jdk8:2.0.21"
          }
        }
`;

    if (src.includes("allprojects {")) {
      src = src.replace("allprojects {", "allprojects {\n" + pinBlock);
    } else {
      src += `\nallprojects {\n${pinBlock}\n}\n`;
    }

    cfg.modResults.contents = src;
    return cfg;
  });
};
