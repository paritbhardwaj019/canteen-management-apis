const express = require("express");
const router = express.Router();
const visitorController = require("../../controllers/visitor.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { checkPermissions } = require("../../middlewares/rbac.middleware");
const { optionalAuth } = require("../../middlewares/auth.middleware");
const multer = require('multer');

// Configure multer with more detailed debugging
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('=== Multer File Filter ===');
    console.log('Incoming file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      encoding: file.encoding
    });
    
    if (!file.mimetype.startsWith('image/')) {
      console.log('Rejecting file: Invalid mime type');
      return cb(new Error('Only image files are allowed!'), false);
    }
    
    console.log('Accepting file');
    return cb(null, true);
  }
}).single('photo'); // Explicitly define the field name here

// Detailed request logging middleware
// const logRequest = (req, res, next) => {
//   console.log('=== Detailed Request Debug ===');
//   console.log('Headers:', req.headers);
//   console.log('Content-Type:', req.headers['content-type']);
//   console.log('Body keys:', Object.keys(req.body || {}));
//   console.log('Files:', req.files);
//   console.log('File:', req.file);
//   next();
// };

router.get(
  "/status/:ticketId",
  optionalAuth,
  visitorController.getVisitorStatus
);

router.use(authenticate);

router.get("/my-requests", visitorController.getVisitorRequests);

router.get("/my-records", visitorController.getVisitorRecords);

router.get(
  "/find",
  checkPermissions(["manage_visitors"]),
  visitorController.findVisitors
);

router.post(
  "/request/add",
  authenticate,
  (req, res, next) => {
    upload(req, res, function(err) {
      console.log('=== Upload Middleware Execution ===');
      if (err instanceof multer.MulterError) {
        console.error('Multer error:', err);
        return res.status(400).json({
          status: 'error',
          message: `Upload error: ${err.message}`
        });
      } else if (err) {
        console.error('Other upload error:', err);
        return res.status(400).json({
          status: 'error',
          message: err.message
        });
      }
      
      // console.log('Upload successful');
      // console.log('File details:', req.file);
      next();
    });
  },
  visitorController.registerVisitorRequest
);

router.put(
  "/process/:ticketId",
  checkPermissions(["approve_visitors"]),
  visitorController.processVisitorRequest
);

router.get(
  "/requests",
  checkPermissions(["view_visitors"]),
  visitorController.getVisitorRequests
);

router.post(
  "/entry/:ticketId",
  checkPermissions(["manage_visitors", "manage_roles"]),
  visitorController.handleVisitorEntry
);

router.get(
  "/records",
  checkPermissions(["view_reports"]),
  visitorController.getVisitorRecords
);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Route Error:', error);
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      status: 'error',
      message: `File upload error: ${error.message}`
    });
  }
  next(error);
});

module.exports = router;
