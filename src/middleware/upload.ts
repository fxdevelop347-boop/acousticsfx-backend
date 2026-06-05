import multer from 'multer';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
/** Max file size for image uploads (20MB). Must match Nginx client_max_body_size. */
export const UPLOAD_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_SIZE = UPLOAD_MAX_FILE_SIZE_BYTES;

const storage = multer.memoryStorage();

export const uploadImageMiddleware = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter(_req, file, cb) {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Use JPEG, PNG, GIF, WebP, or AVIF.'));
    }
  },
}).single('file');

const PDF_TYPE = 'application/pdf';

export const uploadDocumentMiddleware = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter(_req, file, cb) {
    if (file.mimetype === PDF_TYPE) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Use PDF only.'));
    }
  },
}).single('file');

const GLB_TYPES = ['model/gltf-binary', 'application/octet-stream'];

export const uploadModelMiddleware = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter(_req, file, cb) {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (GLB_TYPES.includes(file.mimetype) || ext === 'glb') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Use GLB only.'));
    }
  },
}).single('file');

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
const VIDEO_MAX_SIZE = 100 * 1024 * 1024; // 100MB

export const uploadVideoMiddleware = multer({
  storage,
  limits: { fileSize: VIDEO_MAX_SIZE },
  fileFilter(_req, file, cb) {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (VIDEO_TYPES.includes(file.mimetype) || ext === 'mp4' || ext === 'webm' || ext === 'mov') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Use MP4, WebM, or MOV.'));
    }
  },
}).single('file');
