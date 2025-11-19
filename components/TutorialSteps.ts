// components/TutorialSteps.ts

export type SpotlightTargetKey = "exploreCta" | "daily" | "discover" | null;

export type TutorialStep = {
  titleKey: string;
  descriptionKey: string;
  spotlight: SpotlightTargetKey; // lu par index.tsx
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  // 0) Welcome
  {
    titleKey: "tutorial.index.welcome.title",
    descriptionKey: "tutorial.index.welcome.description",
    spotlight: null,
  },
  // 1) CTA "Lancer l’aventure"
  {
    titleKey: "tutorial.index.cta.title",
    descriptionKey: "tutorial.index.cta.description",
    spotlight: "exploreCta",
  },
  // 2) "Défis du jour"
  {
    titleKey: "tutorial.index.daily.title",
    descriptionKey: "tutorial.index.daily.description",
    spotlight: "daily",
  },
  // 3) "S’inspirer"
  {
    titleKey: "tutorial.index.discover.title",
    descriptionKey: "tutorial.index.discover.description",
    spotlight: "discover",
  },
];
