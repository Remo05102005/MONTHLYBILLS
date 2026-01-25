import { addData, updateData, deleteData, getData, queryData } from './database';
import { set, ref } from 'firebase/database';
import { realtimeDb } from './config';

// Save a custom subcategory for a user
export const saveCustomSubcategory = async (uid, category, subcategory) => {
  try {
    const path = `users/${uid}/customSubcategories/${category}/${subcategory}`;
    await set(ref(realtimeDb, path), { 
      name: subcategory, 
      createdAt: new Date().toISOString() 
    });
    return true;
  } catch (error) {
    console.error('Error saving custom subcategory:', error);
    throw error;
  }
};

// Get custom subcategories for a specific category
export const getCustomSubcategories = async (uid, category) => {
  try {
    const path = `users/${uid}/customSubcategories/${category}`;
    const data = await getData(path);
    if (data) {
      // The subcategory names are the keys at this level (e.g., "Banana", "Mango")
      const subcategoryNames = Object.keys(data);
      
      // For each subcategory name, get the latest record to extract the name and createdAt
      const processedSubcategories = await Promise.all(
        subcategoryNames.map(async (subcatName) => {
          const subcatData = data[subcatName];
          
          // If it's already a simple object with name and createdAt
          if (typeof subcatData === 'object' && subcatData.name) {
            return {
              name: subcatData.name,
              createdAt: subcatData.createdAt || new Date().toISOString()
            };
          }
          // If it's an object with auto-generated keys, get the latest one
          else if (typeof subcatData === 'object') {
            const records = Object.values(subcatData);
            if (records.length > 0) {
              // Sort by createdAt and get the latest
              const latestRecord = records
                .filter(record => record && record.name)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
              
              if (latestRecord) {
                return {
                  name: latestRecord.name,
                  createdAt: latestRecord.createdAt
                };
              }
            }
          }
          
          // Fallback
          return {
            name: subcatName,
            createdAt: new Date().toISOString()
          };
        })
      );
      
      // Sort by creation date
      return processedSubcategories.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    return [];
  } catch (error) {
    console.error('Error getting custom subcategories:', error);
    throw error;
  }
};

// Get all custom subcategories for a user
export const getAllCustomSubcategories = async (uid) => {
  try {
    const path = `users/${uid}/customSubcategories`;
    const data = await getData(path);
    return data || {};
  } catch (error) {
    console.error('Error getting all custom subcategories:', error);
    throw error;
  }
};

// Delete a custom subcategory
export const deleteCustomSubcategory = async (uid, category, subcategory) => {
  try {
    const path = `users/${uid}/customSubcategories/${category}/${subcategory}`;
    await deleteData(path);
    return true;
  } catch (error) {
    console.error('Error deleting custom subcategory:', error);
    throw error;
  }
};

// Check if a subcategory already exists (custom or default)
export const checkSubcategoryExists = async (uid, category, subcategory) => {
  try {
    // Normalize the subcategory name for comparison (trim and lowercase)
    const normalizedSubcategory = subcategory.trim().toLowerCase();
    
    // Check custom subcategories
    const customSubcategories = await getCustomSubcategories(uid, category);
    const customExists = customSubcategories.some(sc => sc.name.trim().toLowerCase() === normalizedSubcategory);
    
    // Check default subcategories (hardcoded in the app)
    const defaultSubcategories = {
      Milk: [],
      Vegetables: [],
      Fruits: [],
      Groceries: [],
      Chicken: [],
      Eggs: [],
      Petrol: ['Bike', 'Scooty', 'Car'],
      Bills: [
        'Phone Bill',
        'Electricity',
        'Toll Gate',
        'Rent',
        'Gas',
        'Cable',
        'Wife',
        'Children',
        'Medical',
        'Fees',
      ],
      Others: [],
    };
    
    const defaultExists = defaultSubcategories[category] && 
      defaultSubcategories[category].some(defaultSub => defaultSub.trim().toLowerCase() === normalizedSubcategory);
    
    return customExists || defaultExists;
  } catch (error) {
    console.error('Error checking subcategory existence:', error);
    throw error;
  }
};
