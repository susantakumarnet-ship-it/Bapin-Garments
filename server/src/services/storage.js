/**
 * Image storage: Cloudinary when CLOUDINARY_URL is set, otherwise local disk
 * (served from /uploads). Files are validated by magic bytes, not by the
 * client-supplied MIME type, and renamed to random names.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { HttpError } from '../utils/helpers.js';

const SIGNATURES = [
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', test: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'webp', test: (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' },
  { ext: 'gif', test: (b) => b.slice(0, 4).toString() === 'GIF8' },
];

export function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  return SIGNATURES.find((s) => s.test(buffer))?.ext || null;
}

let cloudinary = null;
async function getCloudinary() {
  if (!config.cloudinaryUrl) return null;
  if (!cloudinary) {
    cloudinary = (await import('cloudinary')).v2;
    cloudinary.config({ secure: true }); // reads CLOUDINARY_URL from env
  }
  return cloudinary;
}

/** Save an uploaded image buffer. Returns { url, key }. */
export async function saveImage(buffer, folder = 'products') {
  const ext = detectImageType(buffer);
  if (!ext) throw new HttpError(400, 'Only JPG, PNG, WEBP or GIF images are allowed');

  const cld = await getCloudinary();
  if (cld) {
    const result = await new Promise((resolve, reject) => {
      const stream = cld.uploader.upload_stream(
        { folder: `bapin-garments/${folder}`, resource_type: 'image' },
        (err, r) => (err ? reject(err) : resolve(r)),
      );
      stream.end(buffer);
    });
    return { url: result.secure_url, key: `cloudinary:${result.public_id}` };
  }

  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const dir = path.join(config.uploadDir, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buffer);
  return { url: `/uploads/${folder}/${name}`, key: `local:${folder}/${name}` };
}

export async function deleteImage(key) {
  if (!key) return;
  try {
    if (key.startsWith('cloudinary:')) {
      const cld = await getCloudinary();
      if (cld) await cld.uploader.destroy(key.slice('cloudinary:'.length));
    } else if (key.startsWith('local:')) {
      const rel = key.slice('local:'.length);
      const full = path.resolve(config.uploadDir, rel);
      if (full.startsWith(config.uploadDir)) await fs.unlink(full);
    }
  } catch (err) {
    console.warn('[storage] delete failed', key, err.message);
  }
}
