
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Story, Panel, AnalysisResult, RefinedContent } from "../types";

// Models
const TEXT_MODEL = "gemini-2.5-flash"; // Good for search and logic
const IMAGE_MODEL = "gemini-2.5-flash-image"; // "Nano Banana" for images
const ANALYSIS_MODEL = "gemini-3-pro-preview"; // "Pro" for complex reasoning and multimodal analysis

// Helper to get fresh client with latest key
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Helper to retry operations on 429 RESOURCE_EXHAUSTED errors.
 */
async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const isQuotaError = error?.status === "RESOURCE_EXHAUSTED" || error?.code === 429 || (error?.message && error.message.includes("429"));
    
    if (retries > 0 && isQuotaError) {
      console.warn(`Quota exceeded. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Searches for viral Reddit stories using Google Search Grounding.
 */
export const findViralStories = async (topic: string = "general", targetAudience: string = "General Audience"): Promise<Story[]> => {
  try {
    const ai = getAiClient();
    const prompt = `
    Act as a specialized Viral Content Scout. 
    Your goal is to find the most engaging, trending, and viral stories related to "${topic}" by searching across ALL of the following major inspiration sources:

    1. REDDIT (The "Master List"):
       - Best for Kids: r/AmItheButtface, r/KidsAreFuckingStupid, r/TalesFromRetail, r/WholesomeMemes, r/FeelGood, r/Parenting.
       - Best for Adults: r/AmItheAsshole, r/TrueOffMyChest, r/Relationship_Advice, r/EntitledParents, r/TIFU, r/MaliciousCompliance, r/PettyRevenge.
    
    2. SOCIAL MEDIA PLATFORMS:
       - TikTok "Storytime" Trends (multi-part sagas)
       - Instagram Reels (viral voiceover narratives)
       - YouTube (Trending Animation Storytime, True Crime)
       - Twitter/X Threads (Viral storytelling threads)

    3. GLOBAL VIRAL NEWS:
       - Uplifting News, Weird News, Tech Drama, Real-life Viral Events.

    Target Audience: ${targetAudience}.

    Instructions:
    - Search specifically for content that is currently trending or has high historical engagement (top of all time).
    - If the topic is specific (e.g. "scary"), prioritize the relevant sources (e.g. r/NoSleep).
    - If the topic is generic, find the best stories across ALL categories.
    - Extract the core narrative/plot (ignore meta-commentary).
    - Ensure stories are suitable for the Target Audience (filter out extreme violence/NSFW if for Kids).
    
    Return a raw JSON array (no markdown block) of 5 distinct story objects with these properties: 
    - "title": A catchy, viral-style title.
    - "summary": A compelling 2-sentence summary of the plot.
    - "source": The specific platform and subreddit/account (e.g. "Reddit r/NoSleep" or "TikTok Trend").
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    
    // Attempt to parse JSON. 
    let parsed: any[] = [];
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.warn("JSON parse failed, falling back");
      }
    }

    if (parsed.length > 0) {
      return parsed.map((item: any, index: number) => ({
        id: `story-${Date.now()}-${index}`,
        title: item.title,
        summary: item.summary,
        source: item.source || "Viral Source",
        panelCount: 6, // Default for found stories
        targetAudience: targetAudience
      }));
    }

    // Fallback if structured parsing fails but we have text
    return [{
      id: "fallback-1",
      title: "Viral Story Search Result",
      summary: "We found stories but couldn't structure them perfectly. Try refining your search topic.",
      source: "Search System",
      panelCount: 6,
      targetAudience: targetAudience
    }];

  } catch (error) {
    console.error("Error finding stories:", error);
    throw new Error("Failed to fetch viral stories.");
  }
};

/**
 * Creates a structured Story object from a raw user prompt.
 */
export const createStoryFromPrompt = async (userPrompt: string, panelCount: number, targetAudience: string): Promise<Story> => {
  try {
    const ai = getAiClient();
    const prompt = `You are a professional author for best-selling KDP and Etsy ebooks.
    Target Audience: ${targetAudience}
    Task: Turn the following idea into a structured story summary for a ${panelCount}-part picture book.
    User Prompt: "${userPrompt}"
    
    Return a JSON object with:
    - "title": A catchy title optimized for sales.
    - "summary": A compelling 2-3 sentence summary of the plot.
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
             title: {type: Type.STRING},
             summary: {type: Type.STRING}
          },
          required: ["title", "summary"]
        }
      }
    });
    
    const data = JSON.parse(response.text || "{}");
    
    return {
      id: `custom-${Date.now()}`,
      title: data.title || "Untitled Story",
      summary: data.summary || userPrompt,
      source: "User Imagination",
      panelCount: panelCount,
      targetAudience: targetAudience
    };

  } catch (error) {
    console.error("Error creating story from prompt:", error);
    return {
       id: `custom-${Date.now()}`,
       title: "My Custom Story",
       summary: userPrompt,
       source: "User Imagination",
       panelCount: panelCount,
       targetAudience: targetAudience
    };
  }
};

/**
 * Generates a script (panels) for the comic book from a story summary.
 * Uses a two-step prompt to ensure consistency of characters.
 */
export const generateScript = async (story: Story): Promise<Panel[]> => {
  const count = story.panelCount || 6;
  const userStylePreference = story.visualStyle || "Vibrant Digital Cartoon";
  const audience = story.targetAudience || "General Audience";
  
  try {
    const ai = getAiClient();
    // We ask for a structured object containing the character design AND the panels.
    // This forces the model to 'think' about the characters first, which we then inject into every panel description.
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        visualStyle: { 
          type: Type.STRING, 
          description: "Detailed description of the art style, color palette, and lighting based on the user's preference." 
        },
        characterDesign: { 
          type: Type.STRING, 
          description: "Detailed visual description of main characters (e.g., 'Jack: tall, trench coat, fedora. Jill: short, red dress'). This will be used in every image prompt for consistency." 
        },
        panels: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              actionDescription: { type: Type.STRING, description: "Detailed visual prompt for Gemini Flash Image. Focus on visual elements, setting, action, and lighting. Do NOT include dialogue." },
              caption: { type: Type.STRING, description: `Narrative text for the bottom of the page. Tone must be appropriate for ${audience}.` }
            },
            required: ["actionDescription", "caption"],
          }
        }
      },
      required: ["visualStyle", "characterDesign", "panels"]
    };

    const prompt = `Write a ${count}-part story script based on: "${story.title}: ${story.summary}".
    Target Audience: ${audience}.
    
    CRITICAL INSTRUCTIONS FOR CONSISTENCY:
    1. The visual style MUST be based on: "${userStylePreference}". Elaborate on this style to ensure high-quality generation (e.g. lighting, texture, medium).
    2. Define "characterDesign" that fits this style.
    3. Create ${count} panels.
    4. Ensure the story flows logically from start to finish with a clear beginning, middle, and end.
    5. The 'caption' text must be engaging and suitable for ${audience}.
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const data = JSON.parse(response.text || "{}");
    const style = data.visualStyle || userStylePreference;
    const chars = data.characterDesign || "";
    const rawPanels = data.panels || [];

    // Combine style + characters + action into the final image generation prompt
    return rawPanels.map((item: any, index: number) => ({
      id: index,
      // We bake the consistency instructions directly into the description
      description: `Style: ${style}. Characters: ${chars}. Scene: ${item.actionDescription}`,
      caption: item.caption,
      isGenerating: false,
    }));

  } catch (error) {
    console.error("Error generating script:", error);
    // Fallback if schema parsing fails significantly
    return Array(count).fill(null).map((_, i) => ({
        id: i,
        description: `Style: ${userStylePreference}. A scene from the story ${story.title}`,
        caption: "Story processing...",
        isGenerating: false
    }));
  }
};

/**
 * Generates an image for a specific panel description.
 * Wrapped with retry logic for 429 handling.
 */
export const generatePanelImage = async (description: string): Promise<string> => {
  return retryOperation(async () => {
    try {
      const ai = getAiClient();
      // 2.5 Flash Image works best with clear, descriptive prompts.
      // The description already contains Style + Characters + Scene from generateScript.
      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: {
          parts: [{ text: description }]
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1", // keeping 1:1 for versatility, could be 4:3
          }
        }
      });

      // Extract image
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data returned.");

    } catch (error) {
      console.error("Error generating image:", error);
      throw error; // Rethrow for retryOperation to catch
    }
  });
};

/**
 * Generates a cover image for the ebook.
 * Wrapped with retry logic for 429 handling.
 */
export const generateCoverImage = async (title: string, summary: string, style: string = "Professional digital art"): Promise<string> => {
  return retryOperation(async () => {
    try {
      const ai = getAiClient();
      const prompt = `A high quality book cover illustration for a story titled "${title}". 
      The story is about: ${summary}. 
      Style: ${style}.
      Do NOT include text on the image.`;
      
      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: "3:4", // Portrait for cover
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data returned.");
    } catch (error) {
      console.error("Error generating cover:", error);
      throw error; // Rethrow for retryOperation to catch
    }
  });
};

/**
 * Edits an existing image based on a text prompt.
 * Wrapped with retry logic.
 */
export const editPanelImage = async (base64Image: string, prompt: string): Promise<string> => {
  return retryOperation(async () => {
    try {
      const ai = getAiClient();
      const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: cleanBase64
              }
            },
            { text: prompt }
          ]
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No edited image returned.");

    } catch (error) {
      console.error("Error editing image:", error);
      throw error;
    }
  });
};

/**
 * Uses Gemini 3 Pro to analyze the ebook's potential.
 * It looks at the metadata + the generated cover image to give a coherence score.
 */
export const analyzeStoryPotential = async (
  title: string, 
  summary: string, 
  audience: string, 
  style: string,
  coverImageBase64?: string,
  captionsSample?: string
): Promise<AnalysisResult> => {
  try {
    const ai = getAiClient();
    const parts: any[] = [];
    
    // Add cover image if available for style analysis
    if (coverImageBase64) {
      const cleanBase64 = coverImageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: cleanBase64
        }
      });
    }

    const promptText = `
    Act as a highly critical and successful Ebook Publisher for Etsy and Amazon KDP.
    Analyze this story project:
    - Title: "${title}"
    - Summary: "${summary}"
    - Intended Audience: "${audience}"
    - Intended Style: "${style}"
    - Story Captions Sample: "${captionsSample || 'Not provided'}"
    
    ${coverImageBase64 ? "I have attached the generated Cover Art." : "No cover art generated yet."}

    Evaluate the following STRICTLY:
    1. Marketability & SEO: Will this sell? Is the title catchy and keyword-rich for Etsy?
    2. Text Quality: Is the storytelling engaging? Is the vocabulary right for the age group?
    3. Visual Quality: Does the art style (if visible) look professional and match the audience?
    4. Viral Potential: Does it have a strong emotional hook (funny, scary, or heartwarming)?

    Return a JSON object with:
    - "score": number (0-10)
    - "viralPotential": one of ["Low", "Medium", "High", "Viral Hit"]
    - "coherenceCheck": string (Comment on if style fits audience)
    - "critique": string (Overall critique focusing on SEO and Content)
    - "textQuality": string (Specific feedback on writing style and tone)
    - "visualQuality": string (Specific feedback on art style)
    - "suggestions": string[] (3 specific actionable bullet points)
    `;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            viralPotential: { type: Type.STRING, enum: ["Low", "Medium", "High", "Viral Hit"] },
            coherenceCheck: { type: Type.STRING },
            critique: { type: Type.STRING },
            textQuality: { type: Type.STRING },
            visualQuality: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["score", "viralPotential", "coherenceCheck", "critique", "textQuality", "visualQuality", "suggestions"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return {
      score: data.score || 5,
      viralPotential: data.viralPotential || "Low",
      coherenceCheck: data.coherenceCheck || "Not analyzed",
      critique: data.critique || "No feedback provided",
      textQuality: data.textQuality || "Standard",
      visualQuality: data.visualQuality || "Standard",
      suggestions: data.suggestions || ["Try again"]
    };

  } catch (error) {
    console.error("Error in agent analysis:", error);
    return {
      score: 0,
      viralPotential: "Low",
      coherenceCheck: "Error",
      critique: "Failed to contact the publisher agent.",
      textQuality: "Unknown",
      visualQuality: "Unknown",
      suggestions: ["Check internet connection", "Try again"]
    };
  }
};

/**
 * Refines the story content (title, summary, captions) based on Agent critique.
 */
export const refineStoryContent = async (
  currentTitle: string,
  currentSummary: string,
  panels: Panel[],
  critique: string,
  audience: string
): Promise<RefinedContent> => {
  try {
    const ai = getAiClient();
    const prompt = `
    You are a professional editor.
    Task: Rewrite the following story content to address this critique: "${critique}".
    Target Audience: ${audience}.
    
    Current Title: "${currentTitle}"
    Current Summary: "${currentSummary}"
    Current Captions: ${JSON.stringify(panels.map(p => ({id: p.id, caption: p.caption})))}

    Instructions:
    - Make the title more viral/catchy and SEO friendly.
    - Improve the summary.
    - Rewrite the captions to be more engaging and fix any tone issues.
    
    Return JSON with:
    - newTitle
    - newSummary
    - refinedPanels: array of objects {id, caption}
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            newTitle: { type: Type.STRING },
            newSummary: { type: Type.STRING },
            refinedPanels: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  caption: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return {
      newTitle: data.newTitle || currentTitle,
      newSummary: data.newSummary || currentSummary,
      refinedPanels: data.refinedPanels || []
    };

  } catch (error) {
    console.error("Error refining story:", error);
    throw error;
  }
};
