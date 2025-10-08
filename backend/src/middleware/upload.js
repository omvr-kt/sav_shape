const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const ensureUploadDir = () => {
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = ensureUploadDir();
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  // Accepter tous les types par défaut (peut être restreint via ALLOWED_FILE_TYPES si défini)
  const list = process.env.ALLOWED_FILE_TYPES?.split(',').map(s => s.trim()).filter(Boolean);
  if (Array.isArray(list) && list.length > 0) {
    if (list.includes(file.mimetype)) return cb(null, true);
    return cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`), false);
  }
  console.log('[upload middleware] type:', file.mimetype, 'name:', file.originalname);
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 100 * 1024 * 1024, // 100MB
    files: 20 // Jusqu'à 20 fichiers par upload si utilisé
  }
});

const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Fichier trop volumineux (maximum 100MB)'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Trop de fichiers (maximum 5 fichiers)'
      });
    }
  }

  if (error.message.includes('Type de fichier non autorisé')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  next(error);
};

module.exports = {
  upload,
  handleUploadError,
  ensureUploadDir
};
