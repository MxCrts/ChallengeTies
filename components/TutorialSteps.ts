// components/TutorialSteps.ts
// Order steps = order tutorial + order videos (videoTuto1..7)


export type TutorialStep = {
  titleKey: string;
  descriptionKey: string;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  // 0 — Welcome / Vision
  {
    titleKey: "tutorial.steps.welcome.title",
    descriptionKey: "tutorial.steps.welcome.description",
  },
  // 1 — Explore challenges
  {
    titleKey: "tutorial.steps.explore.title",
    descriptionKey: "tutorial.steps.explore.description",
  },
  // 2 — Create / Start a challenge
  {
    titleKey: "tutorial.steps.create.title",
    descriptionKey: "tutorial.steps.create.description",
  },
  // 3 — Focus mode
  {
    titleKey: "tutorial.steps.focus.title",
    descriptionKey: "tutorial.steps.focus.description",
  },
  // 4 — Duo invite
  {
    titleKey: "tutorial.steps.duo.title",
    descriptionKey: "tutorial.steps.duo.description",
  },
  // 5 — Profile / stats
  {
    titleKey: "tutorial.steps.profile.title",
    descriptionKey: "tutorial.steps.profile.description",
  },
  // 6 — Vote New Features
  {
    titleKey: "tutorial.steps.vote.title",
    descriptionKey: "tutorial.steps.vote.description",
  },
];
