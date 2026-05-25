import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || ""; // service role key

const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
  console.log("Checking if 'vouchers' bucket exists...");
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error("Error listing buckets:", listError);
    return;
  }
  
  const vouchersBucket = buckets?.find(b => b.name === "vouchers");
  if (vouchersBucket) {
    console.log("Bucket 'vouchers' already exists.");
  } else {
    console.log("Creating bucket 'vouchers'...");
    const { data, error } = await supabase.storage.createBucket("vouchers", {
      public: true,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "application/pdf"],
      fileSizeLimit: 10485760 // 10MB
    });
    
    if (error) {
      console.error("Error creating bucket:", error);
    } else {
      console.log("Bucket created successfully:", data);
    }
  }
}

setup();
