import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.paltradingbuddy.app',
  appName: 'PAL Trading Buddy',
  webDir: 'frontend/dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
};

export default config;
