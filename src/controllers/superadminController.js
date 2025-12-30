import SuperAdmin from '../models/SuperAdmin.js';
import Tenant from '../models/Tenant.js';
import Conversation from '../models/Conversation.js';
import Analytics from '../models/Analytics.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const admin = await SuperAdmin.findOne({ email });
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    admin.lastLogin = new Date();
    await admin.save();
    
    const token = jwt.sign(
      { id: admin._id, role: 'superadmin', email: admin.email },
      process.env.JWT_SECRET || 'naina_secret_key',
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      admin: { id: admin._id, email: admin.email, name: admin.name }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Dashboard Stats
export const getDashboardStats = async (req, res) => {
  try {
    const totalTenants = await Tenant.countDocuments();
    const activeTenants = await Tenant.countDocuments({ status: 'active' });
    const totalConversations = await Conversation.countDocuments();
    
    const revenueData = await Tenant.aggregate([
      { $group: { _id: null, total: { $sum: '$stats.totalRevenue' } } }
    ]);
    
    res.json({
      totalTenants,
      activeTenants,
      totalConversations,
      totalRevenue: revenueData[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get All Tenants
export const getAllTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find()
      .select('-apiKey')
      .sort({ createdAt: -1 });
    
    res.json({ tenants, total: tenants.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create Tenant
export const createTenant = async (req, res) => {
  try {
    const { brandName, contactEmail, contactName } = req.body;
    
    const tenantId = `tenant_${Date.now()}`;
    const apiKey = `naina_${crypto.randomBytes(32).toString('hex')}`;
    
    const tenant = new Tenant({
      tenantId,
      brandName,
      contactEmail,
      contactName,
      apiKey,
      allowedModels: ['groq', 'gemini']
    });
    
    await tenant.save();
    
    res.status(201).json({
      message: 'Tenant created successfully',
      tenant: { tenantId, brandName, apiKey }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete Tenant
export const deleteTenant = async (req, res) => {
  try {
    await Tenant.findOneAndDelete({ tenantId: req.params.tenantId });
    await Conversation.deleteMany({ tenantId: req.params.tenantId });
    
    res.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ============ ANALYTICS ENDPOINTS ============

// Get Analytics Overview
export const getAnalyticsOverview = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const analytics = await Analytics.find({
      date: { $gte: startDate }
    }).sort({ date: -1 });
    
    const totals = analytics.reduce((acc, day) => ({
      totalChats: acc.totalChats + day.totalChats,
      completedChats: acc.completedChats + day.completedChats,
      abandonedChats: acc.abandonedChats + day.abandonedChats,
      totalConversions: acc.totalConversions + day.totalConversions,
      totalRevenue: acc.totalRevenue + day.totalRevenue,
      productsViewed: acc.productsViewed + day.productsViewed,
      highIntentChats: acc.highIntentChats + day.highIntentChats,
      mediumIntentChats: acc.mediumIntentChats + day.mediumIntentChats,
      lowIntentChats: acc.lowIntentChats + day.lowIntentChats
    }), {
      totalChats: 0,
      completedChats: 0,
      abandonedChats: 0,
      totalConversions: 0,
      totalRevenue: 0,
      productsViewed: 0,
      highIntentChats: 0,
      mediumIntentChats: 0,
      lowIntentChats: 0
    });
    
    const conversionRate = totals.totalChats > 0 
      ? ((totals.totalConversions / totals.totalChats) * 100).toFixed(2)
      : 0;
    
    const completionRate = totals.totalChats > 0
      ? ((totals.completedChats / totals.totalChats) * 100).toFixed(2)
      : 0;
    
    const averageOrderValue = totals.totalConversions > 0
      ? (totals.totalRevenue / totals.totalConversions).toFixed(2)
      : 0;
    
    res.json({
      ...totals,
      conversionRate: parseFloat(conversionRate),
      completionRate: parseFloat(completionRate),
      averageOrderValue: parseFloat(averageOrderValue),
      chartData: analytics.slice(0, 30).reverse()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Intent Distribution
export const getIntentDistribution = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const analytics = await Analytics.find({
      date: { $gte: startDate }
    });
    
    const totals = analytics.reduce((acc, day) => ({
      high: acc.high + day.highIntentChats,
      medium: acc.medium + day.mediumIntentChats,
      low: acc.low + day.lowIntentChats
    }), { high: 0, medium: 0, low: 0 });
    
    res.json(totals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Stage Distribution
export const getStageDistribution = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const analytics = await Analytics.find({
      date: { $gte: startDate }
    });
    
    const totals = analytics.reduce((acc, day) => ({
      hook: acc.hook + (day.stageBreakdown?.hook || 0),
      engage: acc.engage + (day.stageBreakdown?.engage || 0),
      confirm: acc.confirm + (day.stageBreakdown?.confirm || 0),
      recommend: acc.recommend + (day.stageBreakdown?.recommend || 0),
      convert: acc.convert + (day.stageBreakdown?.convert || 0),
      support: acc.support + (day.stageBreakdown?.support || 0)
    }), { hook: 0, engage: 0, confirm: 0, recommend: 0, convert: 0, support: 0 });
    
    res.json(totals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Tenant Analytics
export const getTenantAnalytics = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const analytics = await Analytics.find({
      tenantId,
      date: { $gte: startDate }
    }).sort({ date: -1 });
    
    const totals = analytics.reduce((acc, day) => ({
      totalChats: acc.totalChats + day.totalChats,
      totalConversions: acc.totalConversions + day.totalConversions,
      totalRevenue: acc.totalRevenue + day.totalRevenue
    }), { totalChats: 0, totalConversions: 0, totalRevenue: 0 });
    
    res.json({
      ...totals,
      conversionRate: totals.totalChats > 0 
        ? ((totals.totalConversions / totals.totalChats) * 100).toFixed(2)
        : 0,
      chartData: analytics.slice(0, 30).reverse()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
