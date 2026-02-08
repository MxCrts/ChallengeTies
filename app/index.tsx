// app/index.tsx
import React from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../context/AuthProvider"; // ajuste si besoin

export default function Index() {
  const { user, checkingAuth } = useAuth();

  if (checkingAuth) return null;

  return user ? <Redirect href="/(tabs)" /> : <Redirect href="/login" />;
}