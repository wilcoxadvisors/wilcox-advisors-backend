// routes/files.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const AWS = require('aws-sdk');
const File = require('../models/file');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Configure multer with file size limits and filtering
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'image/jpeg',
      'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, Excel, CSV, and image files are allowed.'), false);
    }
  }
});

// Upload file to S3 with better error handling
router.post('/upload', auth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }

    // Generate a unique filename to prevent collisions
    const uniqueFilename = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: `${req.user.id}/${uniqueFilename}`,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ContentDisposition: 'inline',
    };

    // Upload to S3 with promise handling
    const uploadResult = await s3.upload(params).promise();
    
    // Save file metadata to database
    const file = new File({ 
      userId: req.user.id, 
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      s3Key: uploadResult.Key,
      s3Url: uploadResult.Location
    });
    
    await file.save();
    
    res.status(201).json({ 
      success: true,
      message: 'File uploaded successfully',
      file: {
        id: file._id,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        uploadDate: file.createdAt,
        url: uploadResult.Location
      }
    });
  } catch (error) {
    logger.error(`File upload error: ${error.message}`);
    
    // Return user-friendly error messages
    if (error.name === 'MulterError') {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum file size is 10MB.'
        });
      }
    }
    
    return res.status(500).json({
      success: false,
      message: 'File upload failed. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user's files with pagination
router.get('/files', auth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const totalFiles = await File.countDocuments({ userId: req.user.id });
    const files = await File.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.json({
      success: true,
      files: files.map(file => ({
        id: file._id,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        uploadDate: file.createdAt,
        url: file.s3Url
      })),
      pagination: {
        total: totalFiles,
        page,
        pages: Math.ceil(totalFiles / limit)
      }
    });
  } catch (error) {
    logger.error(`Get files error: ${error.message}`);
    next(error);
  }
});

// Delete file
router.delete('/files/:id', auth, async (req, res, next) => {
  try {
    const file = await File.findOne({ 
      _id: req.params.id,
      userId: req.user.id 
    });
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found or you do not have permission to delete it'
      });
    }
    
    // Delete from S3
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: file.s3Key
    };
    
    await s3.deleteObject(params).promise();
    
    // Delete from database
    await File.deleteOne({ _id: req.params.id });
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    logger.error(`Delete file error: ${error.message}`);
    next(error);
  }
});

module.exports = router;
