// Completely silent sound system per user requirement: all sounds removed from app

class SilentSoundSystem {
  public setMuted(_muted: boolean) {}
  public isMuted(): boolean {
    return true;
  }
  public toggleMute(): boolean {
    return true;
  }
  public playClick() {}
  public playStart() {}
  public playStop() {}
  public playChime() {}
  public playBonk() {}
  public playGatherChime() {}
  public playIphonePickerTick() {}
}

export const soundFx = new SilentSoundSystem();
