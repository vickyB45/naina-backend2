// import ProductMeta from "../models/ProductMeta.js";


// let metaCache = null;

// export async function loadMetadata() {
//   if (!metaCache) {
//     metaCache = await ProductMeta.findOne({});
//     console.log("📦 Loaded Metadata From DB");

//     if (!metaCache) {
//       console.log("⚠️ No metadata doc found. Creating default.");
//       metaCache = await ProductMeta.create({
//         productTypes: {
//           suit: ['suit', 'anarkali', 'punjabi suit', 'salwar'],
//           saree: ['saree', 'sari'],
//           lehenga: ['lehenga', 'ghagra'],
//           kurti: ['kurti', 'kurta'],
//           dupatta: ['dupatta']
//         },
//         nonEthnicItems: ['tshirt', 'jeans', 'top', 'dress'],
//         colors: ['red', 'blue', 'green', 'yellow', 'pink', 'black', 'white'],
//         occasions: ['wedding', 'party', 'festival', 'casual']
//       });
//     }
//   }
//   return metaCache;
// }


import Product from "../models/Product.js";

let metaCache = null;

export async function loadMetadata() {
  if (metaCache) return metaCache;

  console.log("📦 Fetching metadata dynamically from Products DB...");

  const products = await Product.find({});

  if (!products || products.length === 0) {
    console.log("⚠️ No product found. Metadata empty.");
    metaCache = {
      categories: [],
      subCategories: [],
      colors: [],
      sizes: [],
      tags: []
    };
    return metaCache;
  }

  // ---------- Extract Categories ----------
  const categories = [
    ...new Set(products.map(p => p.category?.toLowerCase()).filter(Boolean))
  ];

  // ---------- Extract Tags ----------
  const tags = [
    ...new Set(products.flatMap(p => p.tags || []).map(t => t.toLowerCase()))
  ];

  // ---------- Detect Colors From Product Name ----------
  const allColors = [
    "red","blue","green","yellow","pink","black","white",
    "gold","silver","purple","orange","maroon","grey","brown"
  ]; 

  const colors = [
    ...new Set(
      products
        .map(p => p.name.toLowerCase().split(" "))
        .flat()
        .filter(word => allColors.includes(word))
    )
  ];

  // ---------- Detect Sizes ----------
  const sizeRegex = /\b(xs|s|m|l|xl|xxl|xxxl|28|30|32|34|36|38|40|42)\b/i;

  const sizes = [
    ...new Set(
      products.flatMap(p =>
        p.variants?.map(v => {
          const match = v?.title?.toLowerCase().match(sizeRegex);
          return match ? match[0] : null;
        }) || []
      ).filter(Boolean)
    )
  ];

  // ---------- Subcategories ----------
  const subCategories = [
    ...new Set(
      products
        .map(p => p.name.toLowerCase().split(" "))
        .flat()
        .filter(w =>
          !colors.includes(w) &&
          !sizes.includes(w) &&
          w.length > 3
        )
    )
  ];

  metaCache = {
    categories,
    subCategories,
    colors,
    sizes,
    tags
  };

  console.log("✅ Dynamic metadata generated.");

  return metaCache;
}