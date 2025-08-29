import { CLOUDINARY } from "../config/env";

export const uploadToCloudinary = async (fileUri: string, type: "image" | "video" = "image") => {
  try {
    console.log("🔄 Starting Cloudinary upload:", { fileUri, type });
    
    const data = new FormData();
    data.append("file", {
      uri: fileUri,
      type: type === "image" ? "image/jpeg" : "video/mp4",
      name: `upload.${type === "image" ? "jpg" : "mp4"}`,
    } as any);

    data.append("upload_preset", CLOUDINARY.UPLOAD_PRESET);
    
    console.log("📤 Uploading to:", CLOUDINARY.API_URL);
    console.log("🔧 Upload preset:", CLOUDINARY.UPLOAD_PRESET);

    const res = await fetch(CLOUDINARY.API_URL, {
      method: "POST",
      body: data,
    });

    console.log("📥 Response status:", res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ HTTP Error:", res.status, errorText);
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const result = await res.json();
    console.log("✅ Cloudinary response:", result);

    if (result.secure_url) {
      console.log("🎉 Upload successful:", result.secure_url);
      return result.secure_url;
    } else {
      console.error("❌ No secure_url in response:", result);
      throw new Error(`Cloudinary upload failed: ${result.error?.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error("💥 Cloudinary upload error:", error);
    throw error;
  }
};
