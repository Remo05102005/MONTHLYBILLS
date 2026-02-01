import { realtimeDb } from '../firebase/config';
import { ref, push, update, remove, onValue, get } from 'firebase/database';
import { removeUndefined } from '../utils/cleanObject';
import genAIService from './genaiService';
import { getFoodDataFromDB, addFoodDataToDB } from '../firebase/food';
import { getAuth } from 'firebase/auth';

class NutrientService {
  constructor() {
    this.nutrientRef = ref(realtimeDb, 'nutrients');
  }

  /**
   * Get nutrient data for a specific quantity and unit with new flow
   * @param {string} foodItem - The food item name
   * @param {number} quantity - The quantity
   * @param {string} unit - The unit (grams, ml, pieces, pack)
   * @returns {Promise<Object>} - Calculated nutrient data for the specified quantity
   */
  async getNutrientDataForQuantity(foodItem, quantity, unit) {
    try {
      console.log('NutrientService: getNutrientDataForQuantity called with:', {
        foodItem, quantity, unit
      });
      
      // Step 1: Check if food exists in foodData (centralized database)
      console.log('NutrientService: Checking foodData for existing standard values...');
      const userId = this.getCurrentUserId(); // You'll need to implement this
      const existingFoodData = await getFoodDataFromDB(userId, foodItem);
      console.log('NutrientService: Existing food data:', existingFoodData);
      
      let standardData = null;
      
      if (existingFoodData) {
        console.log('NutrientService: Found existing standard data in foodData');
        standardData = existingFoodData;
      } else {
        console.log('NutrientService: No existing data found, fetching from Gemini API...');
        // Step 2: Make Gemini API call if not exists
        const geminiData = await this.fetchNutrientDataFromGemini(foodItem);
        console.log('NutrientService: Gemini API result:', geminiData);
        
        if (geminiData) {
          console.log('NutrientService: Storing standard values in foodData...');
          // Step 3: Store in foodData (centralized database)
          await addFoodDataToDB(userId, foodItem, geminiData);
          standardData = geminiData;
        } else {
          console.log('NutrientService: No data available from Gemini API');
          return null;
        }
      }

      if (standardData) {
        console.log('NutrientService: Calculating for specified quantity...');
        // Step 4: Calculate user consumption from standard values
        const calculatedData = this.calculateNutrientsForQuantity(standardData, quantity, unit);
        console.log('NutrientService: Calculated nutrient data:', calculatedData);
        return calculatedData;
      }

      return null;
    } catch (error) {
      console.error('NutrientService: Error getting nutrient data for quantity:', error);
      console.error('NutrientService: Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw error;
    }
  }

  /**
   * Fetch nutrient data from Gemini API
   * @param {string} foodItem - The food item name
   * @returns {Promise<Object|null>} - Parsed nutrient data or null if failed
   */
  async fetchNutrientDataFromGemini(foodItem) {
    try {
      console.log('NutrientService: Fetching nutrient data for:', foodItem);
      const prompt = this.createNutrientExtractionPrompt(foodItem);
      console.log('NutrientService: Generated prompt:', prompt.substring(0, 200) + '...');
      
      console.log('NutrientService: Calling genAIService.generateContent...');
      const response = await genAIService.generateContent(prompt, {
        temperature: 0.3,
        maxOutputTokens: 4096
      });

      console.log('NutrientService: Gemini API response received:', response);
      
      if (!response) {
        console.error('NutrientService: No response received from Gemini API');
        // Check if this might be a quota issue
        console.error('NutrientService: This might be due to API quota limits. Please check your Gemini API usage.');
        return null;
      }
      
      return this.parseGeminiResponse(response);
    } catch (error) {
      console.error('NutrientService: Error fetching nutrient data from Gemini:', error);
      console.error('NutrientService: Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Check for quota-related errors
      if (error.message && error.message.includes('429') || error.message.includes('quota')) {
        console.error('NutrientService: API quota exceeded. Please check your Gemini API plan and billing.');
      }
      
      return null;
    }
  }

  /**
   * Create optimized prompt for nutrient extraction
   * @param {string} foodItem - The food item name
   * @returns {string} - Optimized prompt
   */
  createNutrientExtractionPrompt(foodItem) {
    return `Extract nutrient information for "${foodItem}" (Indian/South Indian food focus).

Return ONLY a JSON object with this exact structure:

{
  "foodItem": "${foodItem}",
  "grams": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "fiber": 0,
    "sugar": 0,
    "sodium": 0,
    "cholesterol": 0,
    "vitaminA": 0,
    "vitaminC": 0,
    "calcium": 0,
    "iron": 0
  },
  "ml": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "fiber": 0,
    "sugar": 0,
    "sodium": 0,
    "cholesterol": 0,
    "vitaminA": 0,
    "vitaminC": 0,
    "calcium": 0,
    "iron": 0
  },
  "pieces": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "fiber": 0,
    "sugar": 0,
    "sodium": 0,
    "cholesterol": 0,
    "vitaminA": 0,
    "vitaminC": 0,
    "calcium": 0,
    "iron": 0
  },
  "pack": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "fiber": 0,
    "sugar": 0,
    "sodium": 0,
    "cholesterol": 0,
    "vitaminA": 0,
    "vitaminC": 0,
    "calcium": 0,
    "iron": 0
  }
}

IMPORTANT:
- Return ONLY the JSON object
- No explanations, descriptions, or additional text
- All values must be numbers (no units)
- If data is unavailable for a unit, use 0
- Focus on common Indian/South Indian foods
- Use standard nutritional values per 100g/ml/piece/pack`;
  }

  /**
   * Parse Gemini API response to extract nutrient data
   * @param {string} response - The API response
   * @returns {Object|null} - Parsed nutrient data or null if parsing failed
   */
  parseGeminiResponse(response) {
    try {
      console.log('=== NUTRIENT SERVICE FULL RESPONSE DEBUG ===');
      console.log('Response length:', response.length);
      console.log('Full response content:');
      console.log(response);
      console.log('=== END FULL RESPONSE ===');
      
      // Clean the response to remove markdown formatting
      let cleanResponse = response.trim();
      
      // Remove markdown code block markers if present
      cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      
      console.log('=== CLEANED RESPONSE DEBUG ===');
      console.log('Cleaned response length:', cleanResponse.length);
      console.log('Cleaned response content:');
      console.log(cleanResponse);
      console.log('=== END CLEANED RESPONSE ===');
      
      // Try to find JSON object - more robust approach
      let jsonData = null;
      
      // Method 1: Try to find complete JSON object
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          jsonData = JSON.parse(jsonMatch[0]);
          console.log('NutrientService: Successfully parsed JSON using regex method');
        } catch (parseError) {
          console.log('NutrientService: Regex method failed, trying alternative methods');
        }
      }
      
      // Method 2: If regex method failed, try to extract from start of response
      if (!jsonData) {
        try {
          // Find the first opening brace and last closing brace
          const firstBrace = cleanResponse.indexOf('{');
          const lastBrace = cleanResponse.lastIndexOf('}');
          
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const potentialJson = cleanResponse.substring(firstBrace, lastBrace + 1);
            jsonData = JSON.parse(potentialJson);
            console.log('NutrientService: Successfully parsed JSON using brace extraction method');
          }
        } catch (parseError) {
          console.log('NutrientService: Brace extraction method also failed');
        }
      }
      
      // Method 3: If both methods failed, try to clean and parse again
      if (!jsonData) {
        try {
          // Remove any trailing text after the JSON
          const lines = cleanResponse.split('\n');
          let jsonLines = [];
          let braceCount = 0;
          let inJson = false;
          
          for (const line of lines) {
            if (line.includes('{')) {
              inJson = true;
            }
            if (inJson) {
              jsonLines.push(line);
              braceCount += (line.match(/{/g) || []).length;
              braceCount -= (line.match(/}/g) || []).length;
              if (braceCount === 0 && line.includes('}')) {
                break;
              }
            }
          }
          
          if (jsonLines.length > 0) {
            const potentialJson = jsonLines.join('\n');
            jsonData = JSON.parse(potentialJson);
            console.log('NutrientService: Successfully parsed JSON using line-by-line method');
          }
        } catch (parseError) {
          console.log('NutrientService: Line-by-line method also failed');
        }
      }
      
      if (!jsonData) {
        console.error('NutrientService: All JSON parsing methods failed');
        return null;
      }

      console.log('NutrientService: Parsed JSON data:', JSON.stringify(jsonData, null, 2));
      
      // Validate required structure
      const requiredUnits = ['grams', 'ml', 'pieces', 'pack'];
      const requiredNutrients = [
        'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 
        'sodium', 'cholesterol', 'vitaminA', 'vitaminC', 'calcium', 'iron'
      ];

      for (const unit of requiredUnits) {
        if (!jsonData[unit]) {
          console.error(`Missing unit: ${unit}`);
          return null;
        }
        
        for (const nutrient of requiredNutrients) {
          if (typeof jsonData[unit][nutrient] !== 'number') {
            console.error(`Invalid nutrient value for ${unit}.${nutrient}: ${jsonData[unit][nutrient]} (type: ${typeof jsonData[unit][nutrient]})`);
            return null;
          }
        }
      }

      return jsonData;
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      return null;
    }
  }

  /**
   * Calculate nutrients for a specific quantity and unit from standard values
   * @param {Object} standardData - Standard nutrient data from foodData
   * @param {number} quantity - The quantity
   * @param {string} unit - The unit
   * @returns {Object} - Calculated nutrient data
   */
  calculateNutrientsForQuantity(standardData, quantity, unit) {
    const baseData = standardData[unit];
    if (!baseData) {
      return this.createEmptyNutrientData();
    }

    console.log('NutrientService: Base data for unit:', unit, baseData);
    console.log('NutrientService: Quantity:', quantity);
    
    // Firebase stores data for standard serving sizes:
    // - grams: data is for 100 grams
    // - ml: data is for 100 ml  
    // - pieces: data is for 1 piece
    // - pack: data is for 1 pack
    let multiplier;
    
    if (unit === 'grams' || unit === 'ml') {
      // For grams and ml, data is for 100g/100ml
      multiplier = quantity / 100;
    } else {
      // For pieces and pack, data is for 1 piece/1 pack
      multiplier = quantity;
    }
    
    console.log('NutrientService: Using calculation based on unit type');
    console.log('NutrientService: Unit:', unit, 'Multiplier:', multiplier);
    
    const calculatedData = {
      calories: Math.round(baseData.calories * multiplier),
      protein: Math.round(baseData.protein * multiplier * 10) / 10,
      carbs: Math.round(baseData.carbs * multiplier * 10) / 10,
      fat: Math.round(baseData.fat * multiplier * 10) / 10,
      fiber: Math.round(baseData.fiber * multiplier * 10) / 10,
      sugar: Math.round(baseData.sugar * multiplier * 10) / 10,
      sodium: Math.round(baseData.sodium * multiplier),
      cholesterol: Math.round(baseData.cholesterol * multiplier),
      vitaminA: Math.round(baseData.vitaminA * multiplier),
      vitaminC: Math.round(baseData.vitaminC * multiplier),
      calcium: Math.round(baseData.calcium * multiplier),
      iron: Math.round(baseData.iron * multiplier)
    };
    
    console.log('NutrientService: Calculated data:', calculatedData);
    return calculatedData;
  }


  /**
   * Get food suggestions based on partial input
   * @param {string} partialInput - Partial food item name
   * @param {number} limit - Maximum number of suggestions
   * @returns {Promise<Array>} - Array of food suggestions
   */
  async getFoodSuggestions(partialInput, limit = 10) {
    try {
      const suggestions = [];
      const searchTerm = partialInput.toLowerCase().trim();
      
      if (!searchTerm) {
        return [];
      }

      // Get all nutrients data
      const snapshot = await get(this.nutrientRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // Filter and sort suggestions
        Object.keys(data).forEach(foodKey => {
          const foodName = data[foodKey].foodItem || foodKey;
          if (foodName.toLowerCase().includes(searchTerm)) {
            suggestions.push({
              foodItem: foodName,
              foodKey: foodKey
            });
          }
        });

        // Sort by relevance (exact match first, then by name)
        suggestions.sort((a, b) => {
          const aExact = a.foodItem.toLowerCase() === searchTerm;
          const bExact = b.foodItem.toLowerCase() === searchTerm;
          
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          
          return a.foodItem.localeCompare(b.foodItem);
        });
      }

      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('Error getting food suggestions:', error);
      return [];
    }
  }

  /**
   * Get current user ID from Firebase Auth
   * @returns {string|null} - Current user ID or null if not authenticated
   */
  getCurrentUserId() {
    const auth = getAuth();
    const user = auth.currentUser;
    return user ? user.uid : null;
  }

  /**
   * Create empty nutrient data object
   * @returns {Object} - Empty nutrient data
   */
  createEmptyNutrientData() {
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      cholesterol: 0,
      vitaminA: 0,
      vitaminC: 0,
      calcium: 0,
      iron: 0
    };
  }
}

// Create a singleton instance
const nutrientService = new NutrientService();

export default nutrientService;