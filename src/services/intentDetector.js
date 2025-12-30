export async function detectIntent(userMessage, conversation) {
  const message = userMessage.toLowerCase();
  
  // High intent signals (ready to buy)
  const highIntentKeywords = [
    'buy', 'purchase', 'add to cart', 'checkout', 'order',
    'price', 'cost', 'stock', 'available', 'size', 'color',
    'cod', 'delivery', 'shipping', 'how much', 'when will'
  ];
  
  // Medium intent signals (interested, exploring)
  const mediumIntentKeywords = [
    'show', 'looking for', 'need', 'want', 'searching',
    'gift', 'occasion', 'under', 'budget', 'recommend',
    'suggest', 'best', 'popular', 'trending', 'new'
  ];
  
  // Low intent signals (just browsing)
  const lowIntentKeywords = [
    'just browsing', 'just looking', 'hi', 'hello', 'hey',
    'what', 'tell me', 'info', 'about', 'help'
  ];
  
  // Detect intent level
  let intent = 'low';
  
  if (highIntentKeywords.some(keyword => message.includes(keyword))) {
    intent = 'high';
  } else if (mediumIntentKeywords.some(keyword => message.includes(keyword))) {
    intent = 'medium';
  }
  
  // Extract preferences
  const preferences = extractPreferences(message);
  
  return { intent, preferences };
}

export function extractPreferences(message) {
  const preferences = {};
  
  // Budget extraction
  const budgetMatch = message.match(/under\s+(\d+)|below\s+(\d+)|₹?\s*(\d+)/);
  if (budgetMatch) {
    const amount = budgetMatch[1] || budgetMatch[2] || budgetMatch[3];
    preferences.budget = `under ${amount}`;
  }
  
  // Occasion extraction
  const occasions = ['party', 'wedding', 'casual', 'formal', 'office', 'date', 'everyday'];
  occasions.forEach(occasion => {
    if (message.includes(occasion)) {
      preferences.occasion = occasion;
    }
  });
  
  // Style extraction
  const styles = ['classy', 'trendy', 'minimal', 'bold', 'classic', 'modern', 'ethnic'];
  styles.forEach(style => {
    if (message.includes(style)) {
      preferences.style = style;
    }
  });
  
  // Category extraction (Oment categories)
  const categories = {
    'dress': ['dress', 'dresses', 'gown'],
    'top': ['top', 'shirt', 'blouse', 'crop', 'tshirt', 't-shirt'],
    'bottom': ['bottom', 'jeans', 'pants', 'skirt', 'palazzo'],
    'co-ord': ['coord', 'co-ord', 'set', 'matching']
  };
  
  Object.entries(categories).forEach(([category, keywords]) => {
    if (keywords.some(keyword => message.includes(keyword))) {
      preferences.category = category;
    }
  });
  
  return Object.keys(preferences).length > 0 ? preferences : null;
}
