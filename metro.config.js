const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add OBJ file support
config.resolver.assetExts.push("obj", "mtl", "gltf", "glb");

// Add source map support for better debugging
config.resolver.platforms = ["ios", "android", "native", "web"];

module.exports = config;
