
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SpendLog",
    short_name: "SpendLog",
    description: "Track expenses and split bills with ease.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#17191b",
    theme_color: "#17191b",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
