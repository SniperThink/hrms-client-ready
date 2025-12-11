// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for .cjs and .mjs files (for various npm packages)
config.resolver.sourceExts.push('cjs', 'mjs');

module.exports = config;

