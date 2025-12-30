import express from 'express';
import {
  login,
  getDashboardStats,
  getAllTenants,
  createTenant,
  deleteTenant,
  getAnalyticsOverview,
  getTenantAnalytics,
  getIntentDistribution,
  getStageDistribution
} from '../controllers/superadminController.js';
import { authenticateSuperadmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route
router.post('/login', login);

// Protected routes
router.use(authenticateSuperadmin);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);

// Tenants
router.get('/tenants', getAllTenants);
router.post('/tenants', createTenant);
router.delete('/tenants/:tenantId', deleteTenant);

// Analytics
router.get('/analytics/overview', getAnalyticsOverview);
router.get('/analytics/tenant/:tenantId', getTenantAnalytics);
router.get('/analytics/intent-distribution', getIntentDistribution);
router.get('/analytics/stage-distribution', getStageDistribution);

export default router;
