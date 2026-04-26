import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useNavGuard } from "@/hooks/useNavGuard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTutorial } from "../../../context/TutorialContext";

export default function Screen1() {
  const router = useRouter();
  const nav = useNavGuard(router);
  const { setTutorialStep, setIsTutorialActive } = useTutorial();

  useEffect(() => {
    const skip = async () => {
      try {
        await AsyncStorage.removeItem("hasCompletedTutorialAfterSignup");
        setIsTutorialActive?.(false);
        setTutorialStep?.(0);
      } catch {}
      nav.replace("/(tabs)");
    };
    skip();
  }, []);

  return null;
}