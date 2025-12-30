import express from 'express';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Product from '../models/Product.js';

const router = express.Router();

// ============================================
// 1. OVERVIEW ANALYTICS (UPDATED)
// ============================================
router.get('/overview', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    console.log('📊 [' + new Date().toISOString() + '] Fetching overview analytics...');

    // Mongo check
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        error: 'Database not connected',
      });
    }

    // Date filter
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // --------------------------------------------------
    // 1️⃣ TOTAL CONVERSATIONS
    // --------------------------------------------------
    const totalConversations = await Conversation.countDocuments(dateFilter);

    // --------------------------------------------------
    // 2️⃣ TOTAL VISITORS (unique sessionId)
    // --------------------------------------------------
    const visitorAgg = await Conversation.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$sessionId' } },
      { $count: 'totalVisitors' },
    ]);

    const totalVisitors = visitorAgg[0]?.totalVisitors || 0;

    // --------------------------------------------------
    // 3️⃣ ACTIVE CHATS (last 24h)
    // --------------------------------------------------
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activeChats = await Conversation.countDocuments({
      ...dateFilter,
      lastMessageAt: { $gte: oneDayAgo },
    });

    // --------------------------------------------------
    // 4️⃣ CONVERSION RATE
    // visitor → started chat
    // --------------------------------------------------
    const conversionRate =
      totalVisitors > 0
        ? Number(((totalConversations / totalVisitors) * 100).toFixed(2))
        : 0;

    // --------------------------------------------------
    // Existing message stats (unchanged)
    // --------------------------------------------------
    const messageStats = await Conversation.aggregate([
      { $match: dateFilter },
      {
        $project: {
          messageCount: { $size: { $ifNull: ['$messages', []] } },
        },
      },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: '$messageCount' },
          avgMessagesPerSession: { $avg: '$messageCount' },
        },
      },
    ]);

    const totalMessages = messageStats[0]?.totalMessages || 0;
    const avgMessagesPerSession = Math.round(
      messageStats[0]?.avgMessagesPerSession || 0
    );

    // --------------------------------------------------
    // FINAL RESPONSE
    // --------------------------------------------------
    const data = {
      totalVisitors,
      totalConversations,
      activeChats,
      conversionRate, // 🔥 FIXED (no more undefined)

      totalMessages,
      avgMessagesPerSession,

      _metadata: {
        fetchedAt: new Date().toISOString(),
        mongoConnected: true,
      },
    };

    // Disable caching
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Analytics overview error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 2. CONVERSATION TRENDS (DAILY) – UPDATED
// ============================================
router.get('/trends', async (req, res) => {
  try {
    const { period = '7d' } = req.query;

    console.log('📈 Fetching trends for:', period);

    const daysBack = period === '30d' ? 30 : 7;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const trends = await Conversation.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },

      // Group by DAY
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            sessionId: '$sessionId',
          },
          conversations: { $sum: 1 },
          messagesCount: {
            $sum: { $size: { $ifNull: ['$messages', []] } },
          },
        },
      },

      // Group again by DAY (unique visitors)
      {
        $group: {
          _id: '$_id.day',
          chatVolume: { $sum: '$conversations' }, // 🔥 chats per day
          totalMessages: { $sum: '$messagesCount' },
          visitors: { $sum: 1 }, // unique sessions per day
        },
      },

      // Calculate conversion rate
      {
        $addFields: {
          conversionRate: {
            $cond: [
              { $gt: ['$visitors', 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ['$chatVolume', '$visitors'] },
                      100,
                    ],
                  },
                  2,
                ],
              },
              0,
            ],
          },
        },
      },

      { $sort: { _id: 1 } },

      // Final shape (frontend-friendly)
      {
        $project: {
          _id: 0,
          date: '$_id',
          chatVolume: 1,
          conversionRate: 1,
          totalMessages: 1,
        },
      },
    ]);

    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('❌ Trends error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 3. TOP VIEWED PRODUCTS
// ============================================
router.get('/top-products', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    console.log('🏆 [' + new Date().toISOString() + '] Fetching top products...');
    
    const topProducts = await Conversation.aggregate([
      { $unwind: { path: '$viewedProducts', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$viewedProducts',
          viewCount: { $sum: 1 }
        }
      },
      { $sort: { viewCount: -1 } },
      { $limit: parseInt(limit) }
    ]);
    
    console.log('✅ Top products count:', topProducts.length);
    
    // Get product details
    const productIds = topProducts.map(p => p._id);
    const products = await Product.find({ 
      shopifyId: { $in: productIds } 
    }).lean();
    
    // Enrich with product info
    const enrichedProducts = topProducts.map(tp => {
      const product = products.find(p => p.shopifyId === tp._id);
      return {
        shopifyId: tp._id,
        viewCount: tp.viewCount,
        name: product?.name || 'Unknown Product',
        price: product?.price || 0,
        image: product?.image || product?.featured_image || '',
        category: product?.category || 'Uncategorized'
      };
    });
    
    // Disable caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json({ success: true, data: enrichedProducts });
    
  } catch (error) {
    console.error('❌ Top products error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 4. ENGAGEMENT METRICS
// ============================================
router.get('/engagement', async (req, res) => {
  try {
    console.log('⚡ [' + new Date().toISOString() + '] Fetching engagement metrics...');
    
    const engagement = await Conversation.aggregate([
      {
        $project: {
          messageCount: { $size: { $ifNull: ['$messages', []] } },
          duration: {
            $subtract: [
              { $ifNull: ['$lastMessageAt', '$createdAt'] }, 
              '$createdAt'
            ]
          },
          hasProductViews: {
            $gt: [{ $size: { $ifNull: ['$viewedProducts', []] } }, 0]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$duration' },
          sessionsWithProducts: {
            $sum: { $cond: ['$hasProductViews', 1, 0] }
          },
          totalSessions: { $sum: 1 }
        }
      }
    ]);
    
    const data = engagement[0] || {};
    
    // Convert duration to minutes
    const avgDurationMinutes = Math.round((data.avgDuration || 0) / 1000 / 60);
    const conversionRate = data.totalSessions > 0 
      ? ((data.sessionsWithProducts / data.totalSessions) * 100).toFixed(1)
      : 0;
    
    console.log('✅ Avg session duration:', avgDurationMinutes, 'min');
    console.log('✅ Product view rate:', conversionRate, '%');
    
    // Disable caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json({
      success: true,
      data: {
        avgSessionDuration: avgDurationMinutes,
        productViewRate: parseFloat(conversionRate),
        totalSessions: data.totalSessions || 0,
        sessionsWithProducts: data.sessionsWithProducts || 0
      }
    });
    
  } catch (error) {
    console.error('❌ Engagement error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 5. RECENT CONVERSATIONS
// ============================================
router.get('/recent-conversations', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    console.log('💬 [' + new Date().toISOString() + '] Fetching recent conversations...');
    
    const conversations = await Conversation.find()
      .sort({ lastMessageAt: -1 })
      .limit(parseInt(limit))
      .select('sessionId messages createdAt lastMessageAt viewedProducts visitorInfo')
      .lean();
    
    const formatted = conversations.map(conv => ({
      sessionId: conv.sessionId,
      messageCount: conv.messages?.length || 0,
      productViews: conv.viewedProducts?.length || 0,
      lastMessage: conv.messages?.[conv.messages.length - 1]?.content?.substring(0, 100) || '',
      createdAt: conv.createdAt,
      lastMessageAt: conv.lastMessageAt || conv.createdAt,
      location: conv.visitorInfo?.location || 'Unknown',
      browser: conv.visitorInfo?.browser || 'Unknown'
    }));
    
    console.log('✅ Recent conversations:', formatted.length);
    
    // Disable caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json({ success: true, data: formatted });
    
  } catch (error) {
    console.error('❌ Recent conversations error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 6. CONVERSATION DETAILS
// ============================================
router.get('/conversation/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    console.log('🔍 [' + new Date().toISOString() + '] Fetching conversation:', sessionId);
    
    const conversation = await Conversation.findOne({ sessionId }).lean();
    
    if (!conversation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversation not found' 
      });
    }
    
    console.log('✅ Found conversation with', conversation.messages?.length, 'messages');
    
    // Disable caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json({ success: true, data: conversation });
    
  } catch (error) {
    console.error('❌ Conversation details error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 7. DATABASE STATUS
// ============================================
router.get('/status', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1;
    const conversationCount = await Conversation.countDocuments();
    const productCount = await Product.countDocuments();
    
    // Get latest conversation timestamp
    const latestConvo = await Conversation.findOne()
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean();
    
    // Disable caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json({
      success: true,
      data: {
        databaseConnected: dbStatus,
        totalConversations: conversationCount,
        totalProducts: productCount,
        latestConversation: latestConvo?.createdAt,
        timestamp: new Date(),
        serverTime: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
