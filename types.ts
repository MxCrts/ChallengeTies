export {};

declare global {
  namespace ReactNavigation {
    interface RootParamList {
      "(tabs)/profile": undefined;
      "profile/UserInfo": undefined;
      "challenge-details/[id]": {
        id: string;
        title?: string;
        category?: string;
        description?: string;
      };
    }
  }
}
