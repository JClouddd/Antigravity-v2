import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

/**
 * POST /api/youtube/thumbnail-generate
 *
 * Generates thumbnail images using Gemini's image generation (Imagen 3).
 * Returns base64 images.
 *
 * Body: { prompt, style, aspectRatio }
 */
export async function POST(req) {
  try {
    const { prompt, style = "modern YouTube thumbnail", aspectRatio = "16:9" } = await req.json();

    if (!prompt) {
      return Response.json({ error: "prompt is required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Use Gemini 2.0 Flash with image generation capability
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
    });

    const fullPrompt = `Generate a YouTube thumbnail image. Style: ${style}. Aspect ratio: ${aspectRatio}. 

Description: ${prompt}

Requirements:
- Bold, eye-catching composition
- High contrast colors that stand out at small sizes
- Clean and uncluttered
- Professional quality
- No text overlay (text will be added separately)
- Suitable for YouTube search results and recommendations`;

    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        generationConfig: {
          responseModalities: ["image", "text"],
        },
      });

      const response = result.response;
      const parts = response.candidates?.[0]?.content?.parts || [];

      // Look for image parts
      const imageParts = parts.filter(p => p.inlineData);
      const textParts = parts.filter(p => p.text);

      if (imageParts.length > 0) {
        const images = imageParts.map(p => ({
          data: p.inlineData.data,
          mimeType: p.inlineData.mimeType,
        }));

        return Response.json({
          images,
          description: textParts.map(p => p.text).join("\n") || "",
          prompt,
          generatedAt: new Date().toISOString(),
        });
      }

      // If no images were generated, return the text response
      return Response.json({
        images: [],
        description: textParts.map(p => p.text).join("\n") || "Image generation not available for this prompt",
        fallbackMessage: "Gemini returned text instead of an image. Try a more descriptive prompt, or the image generation feature may not be available on your current API plan.",
        prompt,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      // If image generation fails, provide a helpful error
      if (err.message?.includes("SAFETY") || err.message?.includes("blocked")) {
        return Response.json({
          error: "Image was blocked by safety filters. Try a different prompt.",
          prompt,
        }, { status: 400 });
      }

      if (err.message?.includes("not supported") || err.message?.includes("not available")) {
        return Response.json({
          error: "Image generation is not available on this model or API plan. The thumbnail concepts from Thumbnail Studio can be used as a design brief for Canva, Photoshop, or an image generation tool.",
          prompt,
        }, { status: 400 });
      }

      throw err;
    }
  } catch (err) {
    console.error("[YOUTUBE/THUMBNAIL-GEN]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
