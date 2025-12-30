import express from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

const router = express.Router();

// ============================================
// CREATE ADMIN (First-time setup)
// ============================================
router.post('/create-admin', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    console.log('👤 Creating admin:', email);
    
    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required'
      });
    }
    
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        error: 'Admin with this email already exists'
      });
    }
    
    // Create new admin
    const admin = new Admin({
      email,
      password,
      name,
      role: 'superadmin'
    });
    
    await admin.save();
    
    console.log('✅ Admin created successfully:', email);
    
    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });
    
  } catch (error) {
    console.error('❌ Create admin error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// LOGIN
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Login attempt:', email);
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Find admin
    const admin = await Admin.findOne({ email });
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Check password
    const isPasswordValid = await admin.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Update last login
    admin.lastLogin = new Date();
    await admin.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin._id,
        email: admin.email,
        role: admin.role
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' }
    );
    
    console.log('✅ Login successful:', email);
    
    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        lastLogin: admin.lastLogin
      }
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// VERIFY TOKEN
// ============================================
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    );
    
    // Find admin
    const admin = await Admin.findById(decoded.id).select('-password');
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Admin not found'
      });
    }
    
    res.json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        lastLogin: admin.lastLogin
      }
    });
    
  } catch (error) {
    console.error('❌ Verify token error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
});

// ============================================
// GET ALL ADMINS (Protected)
// ============================================
router.get('/admins', async (req, res) => {
  try {
    const admins = await Admin.find().select('-password').sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: admins.length,
      admins
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
