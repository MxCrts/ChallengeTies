module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],          // prend en charge Expo et désormais Expo Router
    plugins: ['react-native-reanimated/plugin'],  // si tu utilises Reanimated
  };
};
