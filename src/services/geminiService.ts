import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

export const getAI = () => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export const testGeminiConnection = async (): Promise<boolean> => {
  try {
    const ai = getAI();
    await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: "ping" }] }],
    });
    return true;
  } catch (error) {
    console.error("Gemini Connection Test Failed:", error);
    return false;
  }
};

const enhancePrompt = async (text: string, isComic: boolean = false): Promise<string> => {
  try {
    const ai = getAI();
    const systemInstruction = `You are an expert prompt engineer for AI image generation. 
    Your task is to take a Vietnamese input and transform it into a SINGLE, highly detailed, professional English description for an image generation model.
    
    Rules:
    1. Correct any Vietnamese spelling or diacritic errors in the original text.
    2. Expand the description with visual details in English.
    3. IMPORTANT: Merge all provided details into a SINGLE coherent scene. DO NOT create multiple scenarios or options.
    4. If there is dialogue or text that should appear inside the image (like in speech bubbles or captions), keep that specific text in VIETNAMESE.
    5. Clearly specify in the prompt that any text rendered in the image MUST be in Vietnamese with correct accents.
    6. Output ONLY the descriptive text. DO NOT include phrases like "Generate an image", "Create a picture", or "A photo of".
    7. Output ONLY the enhanced description. No explanations.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: `Input: ${text}\nIs Comic: ${isComic}` }] }],
      config: {
        systemInstruction: systemInstruction,
      },
    });
    return response.text || text;
  } catch (error) {
    console.error("Error enhancing prompt:", error);
    return text;
  }
};

export interface ImageGenerationParams {
  subject: string;
  actionContext: string;
  style: string;
  lighting: string;
  color: string;
  camera: string;
}

export const generateImage = async (params: ImageGenerationParams): Promise<string> => {
  const ai = getAI();
  
  // Combine subject and context for a single enhancement call
  const combinedInput = `${params.subject}. ${params.actionContext}`.trim();
  const enhancedPrompt = await enhancePrompt(combinedInput);

  const prompt = `A high quality, visually appealing image.
  Description: ${enhancedPrompt}
  Style: ${params.style}. 
  Lighting: ${params.lighting}. 
  Color palette: ${params.color}. 
  Camera angle and composition: ${params.camera}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error("Gemini returned an empty response (no candidates or parts).");
    }

    let textResponse = "";
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
      if (part.text) {
        textResponse += part.text;
      }
    }
    
    throw new Error(`No image data returned from Gemini. Model response: ${textResponse || "Empty"}`);
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};

export interface ComicGenerationParams extends ImageGenerationParams {
  script: string;
  numPages: number;
}

export const generateComic = async (params: ComicGenerationParams): Promise<string[]> => {
  const ai = getAI();
  const imageUrls: string[] = [];

  // Enhance the script once to get a clean version
  const enhancedScript = await enhancePrompt(params.script, true);

  // We generate images one by one for each page/panel
  for (let i = 1; i <= params.numPages; i++) {
    const prompt = `A professional comic book page (Page ${i} of ${params.numPages}) with panels and speech bubbles. 
    IMPORTANT: Focus ONLY on the content for Page ${i} from the following script.
    Script: ${enhancedScript}. 
    Style: ${params.style} (Comic book style). 
    Lighting: ${params.lighting}. 
    Color palette: ${params.color}. 
    Camera angle: ${params.camera}. 
    High quality, detailed, and visually consistent.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          imageConfig: {
            aspectRatio: "3:4", // Comic pages are often portrait
          },
        },
      });

      if (!response.candidates?.[0]?.content?.parts) {
        throw new Error(`Gemini returned an empty response for page ${i}.`);
      }

      let found = false;
      let textResponse = "";
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          imageUrls.push(`data:image/png;base64,${base64EncodeString}`);
          found = true;
          break;
        }
        if (part.text) {
          textResponse += part.text;
        }
      }
      if (!found) throw new Error(`No image data returned for page ${i}. Model response: ${textResponse || "Empty"}`);
    } catch (error) {
      console.error(`Error generating comic page ${i}:`, error);
      throw error;
    }
  }

  return imageUrls;
};

export interface GameContent {
  title: string;
  description: string;
  type: 'adventure' | 'quiz' | 'logic' | 'wheel' | 'puzzle' | 'maze' | 'rpg';
  content: any;
}

export const generateGame = async (prompt: string): Promise<GameContent> => {
  const ai = getAI();
  const systemInstruction = `You are an expert game designer. 
  Your task is to generate a complete, playable game structure based on a user's prompt in Vietnamese.
  The game can be one of seven types: 'adventure' (text-based), 'quiz' (multiple choice), 'logic' (puzzles), 'wheel' (random student picker with questions), 'puzzle' (hidden image reveal), 'maze' (path through a maze with questions), or 'rpg' (2D adventure with character classes and turn-based combat).
  
  Return the response in JSON format with the following structure:
  {
    "title": "Game Title",
    "description": "Short description",
    "type": "adventure" | "quiz" | "logic" | "wheel" | "puzzle" | "maze" | "rpg",
    "content": { ... type-specific content ... }
  }
  
  For 'adventure':
  "content": {
    "startNode": "node1",
    "nodes": {
      "node1": { "text": "Story text...", "options": [{ "text": "Option 1", "nextNode": "node2" }, ...] },
      ...
    }
  }
  
  For 'quiz':
  "content": {
    "questions": [
      { "question": "Question text?", "options": ["A", "B", "C", "D"], "answer": 0 },
      ...
    ]
  }
  
  For 'logic':
  "content": {
    "puzzles": [
      { "riddle": "Riddle text...", "answer": "Answer", "hint": "Hint text..." },
      ...
    ]
  }

  For 'wheel':
  "content": {
    "students": ["Tên học sinh 1", "Tên học sinh 2", ...],
    "questions": ["Câu hỏi 1", "Câu hỏi 2", ...]
  }

  For 'puzzle':
  "content": {
    "image": "URL of a relevant image or a detailed description of what the image should be",
    "questions": [
      { "text": "Question text?", "options": ["A", "B", "C", "D"], "answerIndex": 0 },
      ...
    ]
  }

  For 'maze':
  "content": {
    "questions": [
      { "text": "Question text?", "options": ["A", "B", "C", "D"], "answerIndex": 0 },
      ...
    ]
  }

  For 'rpg':
  "content": {
    "worldName": "Name of the kingdom",
    "story": "Intro story text",
    "questions": [
      { "text": "Question text?", "options": ["A", "B", "C", "D"], "answerIndex": 0, "difficulty": "Easy" | "Medium" | "Hard" },
      ...
    ],
    "monsters": [
      { "name": "Monster Name", "hp": 50, "attack": 10, "image": "Description of monster appearance" },
      ...
    ]
  }
  
  Language: All game text MUST be in Vietnamese.
  Output ONLY the JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
      },
    });

    if (!response.text) throw new Error("No game content returned from Gemini");
    return JSON.parse(response.text.trim()) as GameContent;
  } catch (error) {
    console.error("Error generating game:", error);
    throw error;
  }
};

export interface MindMapNode {
  id: string;
  text: string;
  children?: MindMapNode[];
}

export interface MCQ {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export const summarizeText = async (text: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: `Hãy tóm tắt văn bản sau đây một cách súc tích và đầy đủ ý chính bằng tiếng Việt:\n\n${text}` }] }],
  });
  return response.text || "";
};

export const generateMindMap = async (text: string): Promise<MindMapNode> => {
  const ai = getAI();
  const systemInstruction = `Bạn là một chuyên gia xây dựng sơ đồ tư duy. 
  Dựa trên văn bản người dùng cung cấp, hãy tạo một sơ đồ tư duy phân cấp dưới dạng JSON.
  Cấu trúc JSON:
  {
    "id": "root",
    "text": "Chủ đề chính",
    "children": [
      { "id": "child1", "text": "Ý phụ 1", "children": [] },
      ...
    ]
  }
  Ngôn ngữ: Tiếng Việt.
  Chỉ xuất JSON.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: text }] }],
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
    },
  });
  return JSON.parse(response.text || "{}") as MindMapNode;
};

export const generateMCQs = async (text: string): Promise<MCQ[]> => {
  const ai = getAI();
  const systemInstruction = `Dựa trên văn bản cung cấp, hãy tạo 5 câu hỏi trắc nghiệm để kiểm tra kiến thức.
  Mỗi câu hỏi phải có 4 lựa chọn, 1 đáp án đúng và giải thích ngắn gọn.
  Cấu trúc JSON:
  [
    {
      "question": "Câu hỏi?",
      "options": ["A", "B", "C", "D"],
      "answerIndex": 0,
      "explanation": "Giải thích..."
    },
    ...
  ]
  Ngôn ngữ: Tiếng Việt.
  Chỉ xuất JSON.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: text }] }],
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
    },
  });
  return JSON.parse(response.text || "[]") as MCQ[];
};
