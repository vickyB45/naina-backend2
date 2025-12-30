import { ComputerVisionClient } from '@azure/cognitiveservices-computervision';
import { ApiKeyCredentials } from '@azure/ms-rest-js';

const endpoint = process.env.AZURE_CV_ENDPOINT;
const key = process.env.AZURE_CV_KEY;

let computerVisionClient = null;

function getClient() {
  if (!computerVisionClient && endpoint && key) {
    computerVisionClient = new ComputerVisionClient(
      new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': key } }),
      endpoint
    );
  }
  return computerVisionClient;
}

// Analyze product image with Azure Computer Vision
export async function analyzeProductImage(imageUrl) {
  try {
    const client = getClient();
    if (!client) {
      console.log('⚠️  Azure CV not configured, skipping image analysis');
      return null;
    }

    console.log(`🔍 Analyzing image: ${imageUrl.substring(0, 60)}...`);

    const features = ['Color', 'Tags', 'Objects', 'Categories'];
    const analysis = await client.analyzeImage(imageUrl, { visualFeatures: features });

    // Extract colors
    const colors = [];
    if (analysis.color) {
      if (analysis.color.dominantColors) {
        colors.push(...analysis.color.dominantColors.map(c => c.toLowerCase()));
      }
    }

    // Map Azure color names to our standard colors
    const colorMap = {
      'gold': ['gold', 'yellow', 'orange'],
      'silver': ['silver', 'grey', 'gray', 'white'],
      'black': ['black'],
      'red': ['red', 'pink', 'purple'],
      'blue': ['blue', 'teal', 'cyan'],
      'green': ['green']
    };

    const detectedColors = [];
    for (const [ourColor, azureColors] of Object.entries(colorMap)) {
      if (colors.some(c => azureColors.includes(c))) {
        detectedColors.push(ourColor);
      }
    }

    // Extract objects and tags
    const objects = analysis.objects?.map(obj => obj.object.toLowerCase()) || [];
    const tags = analysis.tags?.map(tag => tag.name.toLowerCase()) || [];

    // Detect jewelry type from tags/objects
    let detectedCategory = null;
    const allTerms = [...objects, ...tags].join(' ');
    
    if (/necklace|pendant|chain/.test(allTerms)) detectedCategory = 'Necklace';
    else if (/bracelet|bangle|wristband/.test(allTerms)) detectedCategory = 'Bracelet';
    else if (/earring|ear/.test(allTerms)) detectedCategory = 'Earring';
    else if (/ring/.test(allTerms)) detectedCategory = 'Ring';

    return {
      colors: detectedColors,
      objects: objects.slice(0, 5),
      tags: tags.slice(0, 10),
      category: detectedCategory,
      dominantColors: {
        foreground: analysis.color?.dominantColorForeground || null,
        background: analysis.color?.dominantColorBackground || null,
        accent: analysis.color?.accentColor || null
      },
      analyzedAt: new Date()
    };

  } catch (error) {
    console.error('❌ Azure Vision error:', error.message);
    return null;
  }
}

// Batch analyze multiple images
export async function analyzeMultipleImages(imageUrls) {
  const results = [];
  for (const url of imageUrls.slice(0, 3)) { // Limit to first 3 images
    const result = await analyzeProductImage(url);
    if (result) results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
  }
  return results;
}
