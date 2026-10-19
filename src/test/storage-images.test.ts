import { beforeEach, expect, it, vi } from "vitest";
const { signed, bucket } = vi.hoisted(() => ({ signed: vi.fn(), bucket: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: bucket } } }));
import { signLessonImage, IMAGE_URL_STALE_MS, IMAGE_URL_SECONDS } from "@/lib/storage-images";
beforeEach(() => { vi.resetAllMocks(); bucket.mockReturnValue({ createSignedUrl: signed }); });
it("keeps lesson previews on private signed URLs and renews before expiry", async () => {
  signed.mockResolvedValue({ data: { signedUrl: "https://example.invalid/private-signed-image" }, error: null });
  expect(await signLessonImage("student/photo.webp")).toBe("https://example.invalid/private-signed-image");
  expect(bucket).toHaveBeenCalledWith("lessons-images");
  expect(signed).toHaveBeenCalledWith("student/photo.webp", 600);
  expect(IMAGE_URL_STALE_MS).toBeLessThan(IMAGE_URL_SECONDS * 1000);
});
it("propagates storage failures so the reader can retry without public fallback", async () => {
  signed.mockResolvedValue({ data: null, error: new Error("storage denied") });
  await expect(signLessonImage("student/missing.webp")).rejects.toThrow("storage denied");
});