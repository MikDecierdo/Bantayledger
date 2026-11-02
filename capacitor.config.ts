import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ph.bantayledger.app',
  appName: 'BantayLedger AI',
  webDir: 'dist',
  // White from the first frame, so nothing dark shows before the opening animation.
  backgroundColor: '#ffffff'
};

export default config;
