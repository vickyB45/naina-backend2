import Conversation from '../models/Conversation.js';

export async function getSession(sessionId, visitorInfo = {}) {
  let doc = await Conversation.findOne({ sessionId });
  
  if (!doc) {
    doc = new Conversation({
      sessionId,
      messages: [],
      attributes: {},
      visitorInfo: {
        ...visitorInfo,
        firstVisit: new Date(),
        lastVisit: new Date(),
        totalMessages: 0
      }
    });
    await doc.save();
    console.log('✅ New session created:', sessionId);
  } else {
    await Conversation.updateOne(
      { sessionId },
      { 
        $set: { 
          'visitorInfo.lastVisit': new Date(),
          updatedAt: new Date()
        }
      }
    );
  }
  
  return doc;
}

export async function updateSession(sessionId, data) {
  await Conversation.updateOne({ sessionId }, { $set: data });
}

export async function appendMessage(sessionId, role, content) {
  await Conversation.updateOne(
    { sessionId },
    { 
      $push: { messages: { role, content, time: new Date() } },
      $inc: { 'visitorInfo.totalMessages': 1 }
    }
  );
  console.log(`💾 Saved: ${role} → "${content.substring(0, 30)}..."`);
}

export async function trackProductView(sessionId, productIds) {
  if (!productIds || !productIds.length) return;
  
  await Conversation.updateOne(
    { sessionId },
    { 
      $addToSet: { productsViewed: { $each: productIds } },
      $inc: { totalProductsShown: productIds.length }
    }
  );
}

export async function clearSession(sessionId) {
  await Conversation.deleteOne({ sessionId });
}
