import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AsesorKompetensi — Portal Asesor LSP / BNSP",
    short_name: "AsesorKompetensi",
    description:
      "Platform asesmen kompetensi multi-LSP untuk penilaian DIT, FR.IA.06, kemiripan, dan laporan FR.AK.05.",
    start_url: "/login",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#0f766e",
    lang: "id",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
