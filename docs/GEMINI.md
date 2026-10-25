# Gemini AI Specification & Integration Guide

## 1. Overview of AI Usage

Meating uses Google Gemini to provide smart, instant nutritional intelligence for meal logging. Rather than looking up ingredients manually across calorie tables, the user types natural language descriptions of foods (e.g. "3 scrambled eggs with slice of sourdough toast and butter") and receives estimated caloric values and nutritional breakdowns.

---

## 2. Inventory of AI Invocations

### Call 1: Calorie & Macro Estimation

| Property | Value |
|---|---|
| **Purpose** | Estimate total calories and nutritional assumptions for a meal description |
| **Trigger Point** | User clicks the "AI Estimate" button on `/health` (`src/pages/Health.tsx`) |
| **Frequency / Cost** | On-demand (button click only, no background poll or automatic trigger) |
| **Backend Location** | `server.ts` -> `app.post('/api/estimate-calories')` |
| **Client Function** | `src/pages/Health.tsx` -> `estimateCalories()` |
| **Current Model** | `gemini-3-flash-preview` |
| **Recommended Production Model** | `gemini-2.5-flash` or `gemini-1.5-flash` |
| **SDK / Invocation Method** | `@google/genai` -> `ai.models.generateContent` |

#### Payload & Parameters

- **System Instruction**: Integrated via structured output directives in prompt.
- **User Prompt Template**:
  ```
  Estimate the calories for a typical serving of "{{mealName}}". Return the result as JSON.
  ```
- **Generation Parameters**:
  - `responseMimeType`: `"application/json"`
  - `responseSchema`:
    ```json
    {
      "type": "OBJECT",
      "properties": {
        "calories": {
          "type": "NUMBER",
          "description": "Estimated calories"
        },
        "notes": {
          "type": "STRING",
          "description": "Brief explanation of serving size or assumptions"
        }
      },
      "required": ["calories", "notes"]
    }
    ```

#### Input / Output Contracts

**Client Request (`POST /api/estimate-calories`)**:
```json
{
  "mealName": "200g ribeye steak with steamed asparagus"
}
```

**Server Response (HTTP 200)**:
```json
{
  "calories": 540,
  "notes": "Estimated based on 200g cooked ribeye (~500 kcal) and 100g steamed asparagus (~40 kcal) without added oil."
}
```

#### Error Handling & Fallbacks
- If `mealName` is empty, server immediately returns HTTP 400 `{ error: 'Meal name is required' }`.
- If the Gemini API call fails (e.g., rate limit, network timeout), the server returns HTTP 500 `{ error: 'Failed to estimate calories', details: error.message }`.
- Client logs error to console and leaves the calorie input field in editable state so the user can enter calories manually without interruption.

---

## 3. How to Run Gemini Outside Google AI Studio

When moving off AI Studio, call Gemini using `@google/genai` directly with your standard API key:

### A. Server-Side Node.js / Cloudflare Worker Implementation

```typescript
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY // Obtained from Google AI Studio / Cloud Console
});

export async function estimateMealCalories(mealName: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Estimate the calories for a typical serving of "${mealName}". Return the result as JSON.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          calories: { type: Type.NUMBER, description: 'Estimated calories' },
          notes: { type: Type.STRING, description: 'Brief explanation of serving size or assumptions' },
        },
        required: ['calories', 'notes'],
      },
    },
  });

  return JSON.parse(response.text || '{}');
}
```

### B. Direct REST API Fallback (No SDK Required)

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{"text": "Estimate the calories for a typical serving of \"200g grilled salmon\". Return the result as JSON."}]
    }],
    "generationConfig": {
      "responseMimeType": "application/json",
      "responseSchema": {
        "type": "OBJECT",
        "properties": {
          "calories": { "type": "NUMBER" },
          "notes": { "type": "STRING" }
        },
        "required": ["calories", "notes"]
      }
    }
  }'
```
