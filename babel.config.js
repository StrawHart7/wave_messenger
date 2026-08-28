module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo wires expo-router and, when installed, the Reanimated plugin.
  return { presets: ['babel-preset-expo'] };
};
