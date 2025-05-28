// index.js (à la racine)

import React from "react";
import { registerRootComponent } from "expo";
import { ExpoRoot } from "expo-router";

// On importe tout le dossier `app/` manuellement
// via require.context pour qu'Expo Router repère TOUS vos fichiers.
export function App() {
  const ctx = require.context("./app", true, /\.(js|ts|tsx)$/);
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
