const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const config = require("../config/config");
const { badRequest } = require("../utils/api.error");
const path = require("path");

cloudinary.config({
  cloud_name: config.cloudinary.cloud_name,
  api_key: config.cloudinary.api_key,
  api_secret: config.cloudinary.api_secret,
});

const createCloudinaryStorage = (folder, allowedFormats) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `${config.cloudinary.folder}/${folder}`,
      allowed_formats: allowedFormats,
      resource_type: "auto",
      transformation: [{ quality: "auto" }],
    },
  });
};

const imageStorage = createCloudinaryStorage("employee/images", [
  "jpg",
  "jpeg",
  "png",
]);
const documentStorage = createCloudinaryStorage("employee/documents", ["pdf"]);

const excelStorage = multer.memoryStorage();

const imageUpload = multer({
  storage: imageStorage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/i)) {
      return cb(
        badRequest("Only JPG, JPEG, and PNG image files are allowed"),
        false
      );
    }
    cb(null, true);
  },
});

const documentUpload = multer({
  storage: documentStorage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(pdf)$/i)) {
      return cb(badRequest("Only PDF document files are allowed"), false);
    }
    cb(null, true);
  },
});

const excelUpload = multer({
  storage: excelStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;

    if (
      ext === ".xlsx" ||
      ext === ".xls" ||
      mimeType ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(badRequest("Only Excel files (.xlsx, .xls) are allowed"), false);
    }
  },
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        status: "error",
        message: `File size exceeds limit of ${
          config.upload.maxFileSize / (1024 * 1024)
        }MB`,
      });
    }
    return res.status(400).json({
      status: "error",
      message: err.message,
    });
  }

  if (err) {
    return res.status(err.statusCode || 400).json({
      status: "error",
      message: err.message,
    });
  }

  next();
};

const deleteFile = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
    return false;
  }
};

module.exports = {
  uploadEmployeePhoto: imageUpload.single("photo"),
  uploadEmployeeDocument: documentUpload.single("document"),
  uploadMultipleEmployeePhotos: imageUpload.array("photos", 5),
  uploadVisitorPhoto: imageUpload.single("photo"),
  uploadExcelFile: excelUpload.single("file"),
  handleMulterError,
  deleteFile,
  cloudinary,
};
