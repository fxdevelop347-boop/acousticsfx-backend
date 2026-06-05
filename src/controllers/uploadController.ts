import { Request, Response } from 'express';
import ImageKit from '@imagekit/nodejs';
import { toFile } from '@imagekit/nodejs';
import { env } from '../config/env.js';

function getImageKitClient(): ImageKit | null {
  if (!env.IMAGEKIT_PRIVATE_KEY) return null;
  const options: { privateKey: string; publicKey?: string; urlEndpoint?: string } = {
    privateKey: env.IMAGEKIT_PRIVATE_KEY,
  };
  if (env.IMAGEKIT_PUBLIC_KEY) options.publicKey = env.IMAGEKIT_PUBLIC_KEY;
  if (env.IMAGEKIT_URL_ENDPOINT) options.urlEndpoint = env.IMAGEKIT_URL_ENDPOINT;
  return new ImageKit(options);
}

/**
 * GET /api/admin/upload-image-auth
 * Returns ImageKit client-upload params so the browser can POST the file directly to ImageKit
 * (avoids sending the full image through your API server — much faster when API is remote).
 */
export async function getImageKitUploadAuth(req: Request, res: Response): Promise<void> {
  try {
    const client = getImageKitClient();
    if (!client) {
      res.status(503).json({ error: 'Image upload is not configured (ImageKit)' });
      return;
    }
    const publicKey = env.IMAGEKIT_PUBLIC_KEY?.trim();
    if (!publicKey) {
      res.status(503).json({
        error: 'IMAGEKIT_PUBLIC_KEY is not set; use POST /api/admin/upload-image instead.',
      });
      return;
    }
    const auth = client.helper.getAuthenticationParameters();
    res.json({
      token: auth.token,
      expire: auth.expire,
      signature: auth.signature,
      publicKey,
    });
  } catch (err) {
    console.error('getImageKitUploadAuth error:', err);
    res.status(500).json({ error: 'Failed to create upload credentials' });
  }
}

/**
 * POST /api/admin/upload-image
 * Expects multipart/form-data with field "file". Returns { url } from ImageKit.
 */
export async function uploadImage(req: Request, res: Response): Promise<void> {
  try {
    const client = getImageKitClient();
    if (!client) {
      res.status(503).json({ error: 'Image upload is not configured (ImageKit)' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided. Use form field "file".' });
      return;
    }

    const ext = file.originalname.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const uploadable = await toFile(file.buffer, fileName, { type: file.mimetype });

    const result = await client.files.upload({
      file: uploadable,
      fileName,
      folder: '/admin',
    });

    const url = (result as { url?: string }).url;
    if (!url) {
      res.status(500).json({ error: 'Upload succeeded but no URL returned' });
      return;
    }
    res.json({ url });
  } catch (err) {
    console.error('uploadImage error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
}

/**
 * POST /api/admin/upload-document
 * Expects multipart/form-data with field "file" (PDF). Returns { url } from ImageKit.
 */
export async function uploadDocument(req: Request, res: Response): Promise<void> {
  try {
    const client = getImageKitClient();
    if (!client) {
      res.status(503).json({ error: 'File upload is not configured (ImageKit)' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided. Use form field "file".' });
      return;
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.pdf`;
    const uploadable = await toFile(file.buffer, fileName, { type: file.mimetype });

    const result = await client.files.upload({
      file: uploadable,
      fileName,
      folder: '/admin/brochures',
    });

    const url = (result as { url?: string }).url;
    if (!url) {
      res.status(500).json({ error: 'Upload succeeded but no URL returned' });
      return;
    }
    res.json({ url });
  } catch (err) {
    console.error('uploadDocument error:', err);
    res.status(500).json({ error: 'Failed to upload document' });
  }
}

/**
 * POST /api/admin/upload-model
 * Expects multipart/form-data with field "file" (GLB). Returns { url } from ImageKit.
 */
export async function uploadModel(req: Request, res: Response): Promise<void> {
  try {
    const client = getImageKitClient();
    if (!client) {
      res.status(503).json({ error: 'File upload is not configured (ImageKit)' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided. Use form field "file".' });
      return;
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.glb`;
    const uploadable = await toFile(file.buffer, fileName, {
      type: file.mimetype === 'model/gltf-binary' ? file.mimetype : 'model/gltf-binary',
    });

    const result = await client.files.upload({
      file: uploadable,
      fileName,
      folder: '/admin/models',
    });

    const url = (result as { url?: string }).url;
    if (!url) {
      res.status(500).json({ error: 'Upload succeeded but no URL returned' });
      return;
    }
    res.json({ url });
  } catch (err) {
    console.error('uploadModel error:', err);
    res.status(500).json({ error: 'Failed to upload model' });
  }
}

/**
 * POST /api/admin/upload-video
 * Expects multipart/form-data with field "file" (MP4, WebM, MOV). Returns { url } from ImageKit.
 */
export async function uploadVideo(req: Request, res: Response): Promise<void> {
  try {
    const client = getImageKitClient();
    if (!client) {
      res.status(503).json({ error: 'File upload is not configured (ImageKit)' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided. Use form field "file".' });
      return;
    }

    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'mp4';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const uploadable = await toFile(file.buffer, fileName, { type: file.mimetype });

    const result = await client.files.upload({
      file: uploadable,
      fileName,
      folder: '/admin/videos',
    });

    const url = (result as { url?: string }).url;
    if (!url) {
      res.status(500).json({ error: 'Upload succeeded but no URL returned' });
      return;
    }
    res.json({ url });
  } catch (err) {
    console.error('uploadVideo error:', err);
    res.status(500).json({ error: 'Failed to upload video' });
  }
}
