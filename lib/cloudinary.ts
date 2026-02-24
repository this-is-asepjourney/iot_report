/**
 * Upload gambar ke Cloudinary (unsigned upload).
 * Set di .env.local:
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export interface CloudinaryUploadResult {
  secure_url: string;
  url: string;
  public_id: string;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

/**
 * Upload satu file ke Cloudinary. Mengembalikan secure_url untuk disimpan di repair.media.
 */
export async function uploadToCloudinary(file: File): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Cloudinary belum dikonfigurasi. Tambahkan NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME dan NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET di .env.local'
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload gagal: ${res.status} ${err}`);
  }

  const data = (await res.json()) as CloudinaryUploadResult;
  return data.secure_url ?? data.url;
}

/**
 * Normalisasi media repair: bisa array URL (string[]) atau legacy photo_url.
 * Mengembalikan array URL untuk tampilan.
 */
export function getRepairMediaUrls(repair: { media?: string[]; photo_url?: string }): string[] {
  if (repair.media?.length) return repair.media;
  if (repair.photo_url) return [repair.photo_url];
  return [];
}
