# System Prompts Registry

This registry documents all system prompts and structured output schemas used in the Meating application.

---

## 1. Meal Nutrition & Calorie Estimation

- **Prompt ID**: `MEAL_CALORIE_ESTIMATOR_V1`
- **Model**: `gemini-3-flash-preview` / `gemini-2.5-flash`
- **Objective**: Accurately estimate caloric content and nutritional context for food descriptions logged by the user.

### Developer Instruction / Structured Schema
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

### User Prompt
```
Estimate the calories for a typical serving of "{{mealName}}". Return the result as JSON.
```
