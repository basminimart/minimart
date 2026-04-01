import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
  console.log("🚀 Starting image migration...");
  
  // 1. Create bucket if not exists
  const { data: bucket, error: bucketError } = await supabase.storage.createBucket('products', {
    public: true,
    fileSizeLimit: 1048576, // 1MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
  });
  
  if (bucketError && bucketError.message !== 'Bucket already exists') {
    console.error("❌ Error creating bucket:", bucketError.message);
    // Continue anyway as it might just exist
  } else {
    console.log("📁 Products bucket ready.");
  }

  // 2. Fetch all products with base64 images
  // We'll fetch in batches to avoid timeout
  let hasMore = true;
  let offset = 0;
  const limit = 50;
  let migratedCount = 0;

  while (hasMore) {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, image')
      .like('image', 'data:image/%')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("❌ Error fetching products:", error.message);
      break;
    }

    if (!products || products.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`📦 Processing batch of ${products.length} products...`);

    for (const product of products) {
      try {
        const base64Data = product.image;
        // Extract content type and base64 string
        const matches = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!matches) continue;

        const contentType = matches[1];
        const extension = contentType.split('/')[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `${product.id}.${extension}`;
        const filePath = `product_images/${fileName}`;

        // 3. Upload to Storage
        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, buffer, {
            contentType,
            upsert: true
          });

        if (uploadError) {
          console.error(`❌ Failed to upload image for ${product.id}:`, uploadError.message);
          continue;
        }

        // 4. Get Public URL
        const { data: publicData } = supabase.storage
          .from('products')
          .getPublicUrl(filePath);
        
        const publicUrl = publicData.publicUrl;

        // 5. Update Product
        const { error: updateError } = await supabase
          .from('products')
          .update({ image: publicUrl })
          .eq('id', product.id);

        if (updateError) {
          console.error(`❌ Failed to update product ${product.id}:`, updateError.message);
        } else {
          migratedCount++;
          console.log(`✅ Migrated ${product.id} -> ${publicUrl.substring(0, 50)}...`);
        }
      } catch (err) {
        console.error(`💥 Unexpected error for product ${product.id}:`, err.message);
      }
    }

    offset += limit;
  }

  console.log(`✨ Migration complete! Total images moved to storage: ${migratedCount}`);
}

migrate();
