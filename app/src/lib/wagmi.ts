import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygonAmoy } from "wagmi/chains";

// Public RPC — thay bằng Alchemy endpoint khi có API key
// Xem TECHNICAL.md để biết cách lấy key
export const wagmiConfig = getDefaultConfig({
  appName: "BIDV RWA Admin Console",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "PLACEHOLDER_WC_PROJECT_ID",
  chains: [polygonAmoy],
  ssr: true,
});

export { polygonAmoy };
