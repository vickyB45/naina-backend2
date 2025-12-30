import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const admin = await Admin.findById(decoded.id).select('-password');
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Admin not found'
      });
    }
    
    req.admin = admin;
    next();
    
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid authentication'
    });
  }
};
