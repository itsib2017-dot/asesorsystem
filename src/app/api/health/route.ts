import { apiSuccess } from "@/lib/errors";

export async function GET() {
  return apiSuccess({
    status: "ok",
    service: "AsesorKompetensi",
    version: "v1.4",
    timestamp: new Date().toISOString(),
  });
}
