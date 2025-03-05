const express = require('express');
const router = express.Router();
const multer = require('multer');
const AWS = require('aws-sdk');
const File = require('../models/file');
const { auth } = require('../middleware/auth');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload file to S3
router.post('/upload', auth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: `${req.user.id}/${Date.now()}-${req.file.originalname}`,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    const result = await s3.upload(params).promise();
    
    const file = new File({ 
      userId: req.user.id, 
      fileName: req.file.originalname, 
      s3Key: result.Key 
    });
    await file.save();
    
    res.status(201).json({ 
      message: 'File uploaded successfully',
      file: {
        id: file._id,
        fileName: file.fileName,
        url: result.Location
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get user's files
router.get('/files', auth, async (req, res, next) => {
  try {
    const files = await File.find({ userId: req.user.id });
    res.json(files);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
