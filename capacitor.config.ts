import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dukaanpay.app",
  appName: "DukaanPay",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
