import { Server as SocketIOServer } from 'socket.io';
import { processMessage } from './conversationManager.js';
import { shopifyService } from './shopifyService.js';

/**
 * Real-time Communication Manager
 * Handles WebSocket connections for real-time chat and product updates
 */
export function setupSocket(httpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: function(origin, callback) {
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://192.168.1.10:3000',
          'http://192.168.1.10:3001',
          process.env.FRONTEND_URL || 'http://localhost:3000'
        ];

        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else if (process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error('CORS not allowed'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  // Track connected users
  const connectedUsers = new Map();

  /**
   * Connection handler
   */
  io.on('connection', (socket) => {
    console.log(`\n👤 User connected: ${socket.id}`);
    
    // Store connection info
    connectedUsers.set(socket.id, {
      connectedAt: Date.now(),
      sessionId: null,
      lastActivity: Date.now()
    });

    // ===== CHAT EVENTS =====

    /**
     * Handle incoming chat message
     */
    socket.on('chat:message', async (data) => {
      const { sessionId, message } = data;
      const userInfo = connectedUsers.get(socket.id);
      
      if (!sessionId || !message) {
        socket.emit('chat:error', { 
          error: 'Missing sessionId or message' 
        });
        return;
      }

      // Update user info
      if (userInfo) {
        userInfo.sessionId = sessionId;
        userInfo.lastActivity = Date.now();
      }

      console.log(`\n💬 Chat message from ${socket.id}`);
      console.log(`   Session: ${sessionId}`);
      console.log(`   Message: "${message}"`);

      try {
        // Process message with conversation manager
        const result = await processMessage(sessionId, message);

        console.log(`   ✓ Response: "${result.response.substring(0, 50)}..."`);
        console.log(`   ✓ Products: ${result.products.length}`);
        console.log(`   ✓ Stage: ${result.stage}`);

        // Emit response back to user
        socket.emit('chat:response', {
          sessionId,
          response: result.response,
          stage: result.stage,
          intent: result.intent,
          products: result.products,
          sources: result.sources,
          timestamp: new Date().toISOString()
        });

        // Broadcast product update to all users if new products found
        if (result.products && result.products.length > 0) {
          io.emit('products:updated', {
            products: result.products,
            source: 'chat',
            timestamp: new Date().toISOString()
          });
        }

      } catch (error) {
        console.error('❌ Chat error:', error.message);
        socket.emit('chat:error', {
          error: error.message || 'Failed to process message',
          sessionId
        });
      }
    });

    /**
     * Typing indicator
     */
    socket.on('chat:typing', (data) => {
      const { sessionId } = data;
      socket.broadcast.emit('chat:user-typing', {
        userId: socket.id,
        sessionId
      });
    });

    /**
     * Stop typing
     */
    socket.on('chat:stop-typing', (data) => {
      socket.broadcast.emit('chat:user-stopped-typing', {
        userId: socket.id
      });
    });

    // ===== PRODUCT EVENTS =====

    /**
     * Request product refresh/search
     */
    socket.on('products:search', async (data) => {
      const { query, limit = 5 } = data;

      console.log(`\n🔍 Product search: "${query}"`);

      try {
        const products = await shopifyService.searchProducts(query, limit);
        
        console.log(`   ✓ Found ${products.length} products`);

        socket.emit('products:results', {
          query,
          products,
          count: products.length,
          timestamp: new Date().toISOString()
        });

        // Broadcast to all users
        io.emit('products:updated', {
          products,
          source: 'search',
          query,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('❌ Product search error:', error.message);
        socket.emit('chat:error', {
          error: `Product search failed: ${error.message}`
        });
      }
    });

    /**
     * Request product details
     */
    socket.on('products:details', async (data) => {
      const { shopifyId } = data;

      console.log(`\n📦 Fetching product details: ${shopifyId}`);

      try {
        const product = await shopifyService.getProductDetails(shopifyId);
        
        if (product) {
          socket.emit('products:detail-response', {
            product,
            timestamp: new Date().toISOString()
          });
        } else {
          socket.emit('chat:error', {
            error: 'Product not found'
          });
        }

      } catch (error) {
        console.error('❌ Product details error:', error.message);
        socket.emit('chat:error', {
          error: `Failed to fetch product details: ${error.message}`
        });
      }
    });

    /**
     * Check inventory
     */
    socket.on('products:check-inventory', async (data) => {
      const { shopifyId } = data;

      console.log(`\n📊 Checking inventory: ${shopifyId}`);

      try {
        const inventory = await shopifyService.checkInventory(shopifyId);
        
        socket.emit('products:inventory-response', {
          shopifyId,
          ...inventory,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('❌ Inventory check error:', error.message);
        socket.emit('chat:error', {
          error: `Inventory check failed: ${error.message}`
        });
      }
    });

    /**
     * Refresh all products from Shopify
     */
    socket.on('products:refresh-all', async (data) => {
      console.log('\n🔄 Manual product refresh requested');

      try {
        const count = await shopifyService.syncAllProducts();
        
        socket.emit('products:refresh-complete', {
          count,
          timestamp: new Date().toISOString()
        });

        io.emit('system:notification', {
          type: 'success',
          message: `Products updated: ${count} items synced`,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('❌ Product refresh error:', error.message);
        socket.emit('chat:error', {
          error: `Product refresh failed: ${error.message}`
        });
      }
    });

    // ===== STATUS EVENTS =====

    /**
     * Get connection status
     */
    socket.on('status:request', (data) => {
      const shopifyStatus = shopifyService.getStatus();
      
      socket.emit('status:response', {
        socketId: socket.id,
        connected: true,
        connectedUsers: connectedUsers.size,
        shopify: shopifyStatus,
        timestamp: new Date().toISOString()
      });
    });

    /**
     * Get all connected users
     */
    socket.on('users:connected', (data) => {
      socket.emit('users:list', {
        count: connectedUsers.size,
        timestamp: new Date().toISOString()
      });
    });

    // ===== ADMIN EVENTS =====

    /**
     * Admin broadcast message to all users
     */
    socket.on('admin:broadcast', (data) => {
      // In production, verify admin status before allowing
      if (data.adminKey === process.env.ADMIN_SOCKET_KEY) {
        io.emit('admin:message', {
          message: data.message,
          type: data.type || 'info',
          timestamp: new Date().toISOString()
        });
      }
    });

    // ===== DISCONNECTION =====

    /**
     * Handle user disconnect
     */
    socket.on('disconnect', () => {
      const userInfo = connectedUsers.get(socket.id);
      const sessionId = userInfo?.sessionId || 'unknown';
      
      console.log(`\n👤 User disconnected: ${socket.id} (Session: ${sessionId})`);
      console.log(`   Duration: ${Date.now() - (userInfo?.connectedAt || 0)}ms`);
      
      connectedUsers.delete(socket.id);
      
      // Notify others
      io.emit('users:updated', {
        count: connectedUsers.size,
        timestamp: new Date().toISOString()
      });
    });

    /**
     * Handle errors
     */
    socket.on('error', (error) => {
      console.error(`⚠️  Socket error from ${socket.id}:`, error);
    });
  });

  console.log('✅ Socket.io server initialized\n');

  return io;
}

/**
 * Emit event to all connected clients
 */
export function broadcastToAll(io, event, data) {
  io.emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emit event to specific user
 */
export function emitToUser(io, userId, event, data) {
  io.to(userId).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Get connected users count
 */
export function getConnectedUsersCount(io) {
  return io.engine.clientsCount;
}
