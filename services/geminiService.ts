
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedContent, Situation, Target, MessageStyle, ImageStyle, QuoteTheme, QuoteOption } from "../types";

export const fetchQuoteOptions = async (theme: QuoteTheme): Promise<QuoteOption[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `주제: ${theme}. 가장 유명하고 깊이 있는 명언 5개와 그 명언자를 추출하세요.`,
    config: {
      systemInstruction: "당신은 세계적인 인문학자이자 디자이너입니다. 요청한 주제에 대해 가장 강력한 울림을 주는 명언 5개를 명언자와 함께 JSON 배열로 응답하세요. 명언자는 한국어로 적절히 번역하세요.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            author: { type: Type.STRING }
          },
          required: ["text", "author"]
        }
      }
    }
  });
  
  const text = response.text;
  if (!text) throw new Error("Empty response");
  return JSON.parse(text.trim());
};

export const generateGreetingContent = async (
  situation: Situation, 
  target: Target,
  sender: string,
  userPrompt: string,
  style: MessageStyle,
  quoteTheme: QuoteTheme,
  isQuoteOnly: boolean = false,
  selectedQuoteText?: string 
): Promise<GeneratedContent> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const now = new Date();
  
  const promptContent = isQuoteOnly 
    ? `선택된 명언: "${selectedQuoteText}". 이 명언에 어울리는 비주얼 테마와 대안 문구를 생성하세요.`
    : `작성자: ${sender}, 대상: ${target}, 상황: ${situation}, 스타일: ${style}. 추가요청: ${userPrompt}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: promptContent,
    config: {
      systemInstruction: `
        당신은 대한민국 최고의 리더십 메시지 전문가이자 20년차 베테랑 카피라이터입니다.
        
        - 현재 날짜(${now.toLocaleDateString()})와 절기를 반영한 시적이고 전문적인 문장을 작성하세요.
        - mainMessage: ${selectedQuoteText ? `"${selectedQuoteText}"를 그대로 사용하세요.` : "3-5줄의 세련된 비즈니스 인사말."}
        - alternativeMessage: 다른 느낌의 대안 문구.
        - bgTheme: 이 문구의 영혼을 시각화할 수 있는 구체적인 이미지 키워드 (영어 위주). 자연 테마일 경우 상황(일출, 일몰)과 계절감을 명시하세요.
        - recommendedSeason: 디자인 가이드.
        
        JSON으로 응답하세요.
      `,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          mainMessage: { type: Type.STRING },
          alternativeMessage: { type: Type.STRING },
          wiseSayingOptions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                author: { type: Type.STRING }
              }
            }
          },
          bgTheme: { type: Type.STRING },
          recommendedSeason: { type: Type.STRING }
        },
        required: ["mainMessage", "alternativeMessage", "bgTheme", "recommendedSeason"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Empty response");
  return { ...JSON.parse(text.trim()), sender, situation, target };
};

export const generateCardImage = async (
  theme: string, 
  style: ImageStyle, 
  designRequirement: string,
  referenceImage?: string,
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '1:1',
  imageType?: string,
  imageStylePreset?: string,
  refinementText?: string,
  messageContext?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const promptText = `
    AS A MASTER DESIGNER WITH 20 YEARS OF EXPERIENCE:
    
    1. IMAGE TYPE ANALYSIS: The user has selected "${imageType}". 
       - IF "${imageType}" IS "Nature": YOU MUST GENERATE A PURE WILDERNESS MASTERPIECE. 
       - ABSOLUTELY PROHIBITED: No buildings, no man-made roads, no street lamps, no fences, no modern structures. 
       - ELEMENTS TO USE: Epic mountains, vast oceans, ancient forests, mist, sun rays, and majestic skies.

    2. REFERENCE SUBJECT SYNTHESIS:
       ${referenceImage ? `
       - ANALYZE the reference image's main subject (e.g., a horse, a bird, a figure).
       - EXTRACT the silhouette and heroic essence of that subject.
       - REIMAGINE the subject in a grand, cinematic nature setting. 
       - EXAMPLE: If a horse is present, show it rearing up heroically on a misty mountain ridge at sunrise.
       - MATCH THE COMPOSITION: Use the same dynamic angle and focal points from the reference.
       ` : "Create a grand, symbolic landscape that matches the message context."}

    3. STYLE & LIGHTING:
       - Style: ${imageStylePreset || "Cinematic Masterpiece"}.
       - Theme: ${theme}.
       - Visual Direction: ${designRequirement}.
       - Context: ${messageContext || ""}.
       - Lighting: Use "God Rays", "Golden Hour", or "Dramatic Backlighting" to create a signature presence.

    4. FINAL QUALITY:
       - Pristine, text-free, professional high-end background.
       - High contrast and deep emotional resonance.
       - Balanced negative space for typography.
    
    ${refinementText ? `Artist's refinement feedback: ${refinementText}.` : ""}
  `;

  const contents: any = { parts: [{ text: promptText }] };
  if (referenceImage) {
    const [header, data] = referenceImage.split(',');
    const mimeType = header.split(':')[1].split(';')[0];
    contents.parts.push({ inlineData: { data, mimeType } });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents,
    config: { imageConfig: { aspectRatio, imageSize: "1K" } }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return 'https://images.unsplash.com/photo-1497215728101-856f4ea42174';
};

export const generateCardVideo = async (
  theme: string,
  designRequirement: string,
  referenceImage?: string,
  aspectRatio: '16:9' | '9:16' = '16:9',
  messageContext?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const promptText = `
    20-YEAR VETERAN DESIGNER - CINEMATIC VIDEO DIRECTION:
    
    - THEME: ${theme}.
    - CONTEXT: "${messageContext}".
    - TYPE: Pure Nature (if Nature is selected, strictly avoid buildings and man-made structures).
    
    ${referenceImage ? `
    - SUBJECT ANALYSIS: Identify the hero object/creature in the reference.
    - DYNAMIC EVOLUTION: Bring the reference to life. If it's a horse, animate it rearing up against a sunrise. 
    - COMPOSITION: Keep the same powerful camera angle and framing.
    ` : "Create an epic, moving nature landscape."}
    
    - MOTION: Slow, elegant, and majestic camera movements.
    - LIGHTING: Ethereal and transitioning with the season/time of day.
    - NO TEXT, NO PEOPLE, NO MODERN ARTIFACTS.
  `;

  const videoConfig: any = {
    model: 'veo-3.1-fast-generate-preview',
    prompt: promptText,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio
    }
  };

  if (referenceImage) {
    const [header, data] = referenceImage.split(',');
    const mimeType = header.split(':')[1].split(';')[0];
    videoConfig.image = { imageBytes: data, mimeType };
  }

  let operation = await ai.models.generateVideos(videoConfig);
  
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed");
  
  return `${downloadLink}&key=${process.env.API_KEY}`;
};
