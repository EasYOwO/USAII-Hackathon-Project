/**
 * Gemini API Integration Layer
 * Handles communication with Google Gemini model
 * Supports structured output, multilingual support, audio recognition
 */

import type { GeminiAIResponse, Language, DialogState, UserProfile } from './types';
import { SYSTEM_PROMPTS, generateContextPrompt } from './prompts';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export function isGeminiConfigured() {
  return Boolean(GEMINI_API_KEY?.trim());
}

if (!isGeminiConfigured()) {
  console.warn('GEMINI_API_KEY not set, AI functions will use mock responses');
}

// ============== Type Definitions ==============
type GeminiContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiMessage = {
  role: 'user' | 'model';
  parts: GeminiContentPart[];
};

// ============== Main Service Class ==============
export class GeminiAIService {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || GEMINI_API_KEY || '';
    this.model = model || GEMINI_MODEL;
  }

  private getGenerateContentUrl() {
    const model = this.model.trim().replace(/^["']|["']$/g, '');
    return `${GEMINI_API_BASE_URL}/${model}:generateContent?key=${this.apiKey}`;
  }

  private async postGenerateContent(requestBody: unknown) {
    const retryableStatuses = new Set([429, 500, 502, 503, 504]);
    let lastError = '';

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(this.getGenerateContentUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) return response;

      lastError = await response.text();
      if (!retryableStatuses.has(response.status) || attempt === 2) {
        console.error('Gemini API Error:', lastError);
        throw new Error(`Gemini API error: ${response.status} ${lastError}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }

    throw new Error(`Gemini API error: ${lastError || 'request failed'}`);
  }

  /**
   * Call Gemini API to get structured JSON response
   */
  async callGemini(
    messages: GeminiMessage[],
    language: Language = 'zh_CN',
    state: DialogState = 'GATHER_PROFILE',
    context: Record<string, any> = {},
  ): Promise<GeminiAIResponse> {
    if (!this.apiKey) {
      console.warn('No valid API Key found, returning mock response');
      return this.getMockResponse(language, state);
    }

    try {
      const systemPrompt = SYSTEM_PROMPTS[language];
      const stateContextPrompt = generateContextPrompt(state, language, context);
      const fullSystemPrompt = `${systemPrompt}\n\n${stateContextPrompt}`;
      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [{ text: fullSystemPrompt }],
          },
          ...messages.map((msg) => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: msg.parts,
          })),
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              reply_to_user: { type: 'string' },
              extracted_data: { type: 'object' },
              next_state: { type: 'string' },
              confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] },
              needs_clarification: { type: 'boolean' },
              clarification_field: { type: 'string' },
            },
            required: ['reply_to_user', 'extracted_data', 'confidence'],
          },
        },
      };

      const response = await this.postGenerateContent(requestBody);

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        console.warn('Invalid Gemini response');
        throw new Error('Invalid Gemini response');
      }

      const parsed = JSON.parse(content) as GeminiAIResponse;
      return this.normalizeResponse(parsed, state);
    } catch (error) {
      console.error('Gemini API call failed:', error);
      throw error instanceof Error ? error : new Error('Gemini API call failed');
    }
  }

  /**
   * Plain-text Gemini reply for Q&A style prompts.
   */
  async generateTextReply(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    const response = await this.postGenerateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
      },
    });

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!content) {
      throw new Error('Invalid Gemini text response');
    }
    return content;
  }

  /**
   * Structured elderly-assistant reply.
   */
  async callGeminiElderly(
    systemPrompt: string,
    messages: GeminiMessage[],
    responseSchema: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    const response = await this.postGenerateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }],
        },
        ...messages.map((msg) => ({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: msg.parts,
        })),
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.3,
      },
    });

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('Invalid Gemini elderly response');
    }
    return JSON.parse(content) as Record<string, unknown>;
  }

  /**
   * Process audio message (speech-to-text + understanding)
   */
  async processAudioMessage(
    audioData: string, // Base64
    mimeType: string,
    language: Language,
    messages: GeminiMessage[],
    state: DialogState,
    context: Record<string, any> = {},
  ): Promise<GeminiAIResponse> {
    if (!this.apiKey) {
      return this.getMockResponse(language, state);
    }

    try {
      const systemPrompt = SYSTEM_PROMPTS[language];
      const stateContextPrompt = generateContextPrompt(state, language, context);
      const fullSystemPrompt = `${systemPrompt}\n\n${stateContextPrompt}\n\nFirst transcribe the user's speech into text, then process according to the rules.`;
      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: fullSystemPrompt },
              {
                inlineData: {
                  mimeType,
                  data: audioData,
                },
              },
            ],
          },
          ...messages.map((msg) => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: msg.parts,
          })),
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              reply_to_user: { type: 'string' },
              extracted_data: { type: 'object' },
              next_state: { type: 'string' },
              confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] },
              needs_clarification: { type: 'boolean' },
              clarification_field: { type: 'string' },
            },
            required: ['reply_to_user', 'extracted_data', 'confidence'],
          },
        },
      };

      const response = await this.postGenerateContent(requestBody);

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(content) as GeminiAIResponse;
      return this.normalizeResponse(parsed, state);
    } catch (error) {
      console.error('Audio processing failed:', error);
      return this.getMockResponse(language, state);
    }
  }

  /**
   * Normalize response to ensure all required fields are included
   */
  private normalizeResponse(
    response: Partial<GeminiAIResponse>,
    state: DialogState,
  ): GeminiAIResponse {
    return {
      reply_to_user: response.reply_to_user || 'Sorry, I did not understand. Could you please repeat?',
      extracted_data: response.extracted_data || {},
      next_state: response.next_state || state,
      confidence: response.confidence || 'Medium',
      needs_clarification: response.needs_clarification || false,
      clarification_field: response.clarification_field,
    };
  }

  /**
   * Get mock response (for development and debugging)
   */
  private getMockResponse(language: Language, state: DialogState): GeminiAIResponse {
    const mockResponses: Record<Language, Record<DialogState, GeminiAIResponse>> = {
      zh_CN: {
        INIT: {
          reply_to_user: 'Welcome to the Government Assistance Application Assistant! I am your AI assistant. Could you please tell me your full name and IC number?',
          extracted_data: {},
          next_state: 'GATHER_PROFILE',
          confidence: 'High',
        },
        GATHER_PROFILE: {
          reply_to_user: '好的，我记下了。那请问您今年多少岁呢？',
          extracted_data: { name: '[示例名字]' },
          next_state: 'GATHER_PROFILE',
          confidence: 'Medium',
        },
        FORM_MATCHING: {
          reply_to_user: '根据您的信息，我找到了几个可能适合您的政府援助项目。让我给您介绍一下...',
          extracted_data: {},
          next_state: 'FORM_EXPLANATION',
          confidence: 'High',
        },
        FORM_EXPLANATION: {
          reply_to_user: '这个项目主要是帮助符合条件的人申报补助金。最重要的条件是...',
          extracted_data: {},
          next_state: 'FORM_FILLING',
          confidence: 'High',
        },
        FORM_FILLING: {
          reply_to_user: '现在让我问您一些具体的信息。首先，请问您的家庭年收入大概是多少？',
          extracted_data: {},
          next_state: 'FORM_FILLING',
          confidence: 'Medium',
        },
        CONFIRM_TERMS: {
          reply_to_user: '最后，您需要同意一些条款。简单地说，就是您确认提供的信息都是真实的。您同意吗？',
          extracted_data: {},
          next_state: 'COMPLETED',
          confidence: 'High',
        },
        COMPLETED: {
          reply_to_user: '太好了！我已经帮您整理好这次流程的信息。流程完成后，临时文件会被清除。感谢您的配合！',
          extracted_data: {},
          confidence: 'High',
        },
      },
      ms_MY: {
        INIT: {
          reply_to_user: 'Selamat datang ke pembantu permohonan bantuan kerajaan! Saya adalah pembantu AI anda. Bolehkah anda memberitahu nombor telefon anda?',
          extracted_data: {},
          next_state: 'GATHER_PROFILE',
          confidence: 'High',
        },
        GATHER_PROFILE: {
          reply_to_user: 'Baik, saya catat. Boleh saya tahu berapa umur anda?',
          extracted_data: { name: '[Nama Contoh]' },
          next_state: 'GATHER_PROFILE',
          confidence: 'Medium',
        },
        FORM_MATCHING: {
          reply_to_user: 'Berdasarkan maklumat anda, saya telah menemui beberapa projek bantuan yang mungkin sesuai...',
          extracted_data: {},
          next_state: 'FORM_EXPLANATION',
          confidence: 'High',
        },
        FORM_EXPLANATION: {
          reply_to_user: 'Projek ini adalah untuk membantu orang yang layak membuat permohonan untuk subsidi...',
          extracted_data: {},
          next_state: 'FORM_FILLING',
          confidence: 'High',
        },
        FORM_FILLING: {
          reply_to_user: 'Sekarang, bolehkah anda beritahu berapa pendapatan tahunan keluarga anda?',
          extracted_data: {},
          next_state: 'FORM_FILLING',
          confidence: 'Medium',
        },
        CONFIRM_TERMS: {
          reply_to_user: 'Akhirnya, anda perlu bersetuju dengan syarat-syarat. Ringkasnya, anda mengesahkan semua maklumat adalah benar. Anda bersetuju?',
          extracted_data: {},
          next_state: 'COMPLETED',
          confidence: 'High',
        },
        COMPLETED: {
          reply_to_user: 'Bagus! Saya telah mengatur maklumat untuk aliran ini. Dokumen sementara dipadam selepas aliran selesai. Terima kasih!',
          extracted_data: {},
          confidence: 'High',
        },
      },
      en_US: {
        INIT: {
          reply_to_user: 'Welcome to the government assistance application assistant! I am your AI helper. May I have your full name and IC number please?',
          extracted_data: {},
          next_state: 'GATHER_PROFILE',
          confidence: 'High',
        },
        GATHER_PROFILE: {
          reply_to_user: 'Got it. How old are you?',
          extracted_data: { name: '[Example Name]' },
          next_state: 'GATHER_PROFILE',
          confidence: 'Medium',
        },
        FORM_MATCHING: {
          reply_to_user: 'Based on your information, I found several programs that may suit you. Let me explain...',
          extracted_data: {},
          next_state: 'FORM_EXPLANATION',
          confidence: 'High',
        },
        FORM_EXPLANATION: {
          reply_to_user: 'This program is to help eligible people apply for subsidies. The main requirement is...',
          extracted_data: {},
          next_state: 'FORM_FILLING',
          confidence: 'High',
        },
        FORM_FILLING: {
          reply_to_user: 'Now, what is your approximate annual household income?',
          extracted_data: {},
          next_state: 'FORM_FILLING',
          confidence: 'Medium',
        },
        CONFIRM_TERMS: {
          reply_to_user: 'Finally, you need to agree with the terms. Basically, you confirm the information provided is truthful. Do you agree?',
          extracted_data: {},
          next_state: 'COMPLETED',
          confidence: 'High',
        },
        COMPLETED: {
          reply_to_user: 'Great! I have organized the information for this flow. The temporary document is cleared when the flow is complete. Thank you!',
          extracted_data: {},
          confidence: 'High',
        },
      },
    };

    return (
      mockResponses[language]?.[state] || {
        reply_to_user: 'How can I help you?',
        extracted_data: {},
        confidence: 'Low',
      }
    );
  }
}

// Create global instance
export const geminiAIService = new GeminiAIService();
