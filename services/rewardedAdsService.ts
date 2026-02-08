// services/rewardedAdsService.ts
import { Platform } from "react-native";
import {
  RewardedAd,
  AdEventType,
  RewardedAdEventType,
} from "react-native-google-mobile-ads";

type ShowResult = "earned" | "closed" | "error";

class RewardedAdsService {
  private instances = new Map<string, RewardedAd>();
  private loading = new Set<string>();
  private ready = new Set<string>();
  private showLock = false;

  private getOrCreate(adUnitId: string) {
    const existing = this.instances.get(adUnitId);
    if (existing) return existing;

    const ad = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    this.instances.set(adUnitId, ad);
    return ad;
  }

  isReady(adUnitId: string) {
    return this.ready.has(adUnitId);
  }

  async preload(adUnitId: string) {
    if (!adUnitId) return;
    if (this.ready.has(adUnitId)) return;
    if (this.loading.has(adUnitId)) return;

    const ad = this.getOrCreate(adUnitId);
    this.loading.add(adUnitId);

    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };

      const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        this.ready.add(adUnitId);
        this.loading.delete(adUnitId);
        unsubLoaded();
        unsubError();
        finish();
      });

      const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
        this.ready.delete(adUnitId);
        this.loading.delete(adUnitId);
        unsubLoaded();
        unsubError();
        finish(); // fail-soft
      });

      try {
        ad.load();
      } catch {
        this.ready.delete(adUnitId);
        this.loading.delete(adUnitId);
        unsubLoaded();
        unsubError();
        finish();
      }
    });
  }

  async show(adUnitId: string): Promise<ShowResult> {
    if (!adUnitId) return "error";
    if (this.showLock) return "error";
    this.showLock = true;

    const ad = this.getOrCreate(adUnitId);

    // si pas prête, on tente un preload rapide
    if (!this.ready.has(adUnitId)) {
      await this.preload(adUnitId);
    }

    // si toujours pas prête, fail soft
    if (!this.ready.has(adUnitId)) {
      this.showLock = false;
      return "error";
    }

     return new Promise<ShowResult>((resolve) => {
      let earned = false;
      let finished = false;

      const safeResolve = (r: ShowResult) => {
        if (finished) return;
        finished = true;
        this.showLock = false;
        resolve(r);
      };

      const cleanup = () => {
        try { unsubEarned(); } catch {}
        try { unsubClosed(); } catch {}
        try { unsubError(); } catch {}
      };

      const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      });

      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        this.ready.delete(adUnitId); // consommée
        cleanup();
        this.preload(adUnitId).catch(() => {});
        safeResolve(earned ? "earned" : "closed");
      });

      const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
        this.ready.delete(adUnitId);
        cleanup();
        this.preload(adUnitId).catch(() => {});
        safeResolve("error");
      });

      try {
        ad.show();
      } catch {
        this.ready.delete(adUnitId);
        cleanup();
        this.preload(adUnitId).catch(() => {});
        safeResolve("error");
      }
    });
  }
}

export const rewardedAdsService = new RewardedAdsService();
