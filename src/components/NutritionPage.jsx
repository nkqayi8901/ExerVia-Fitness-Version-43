//watched https://www.youtube.com/watch?v=TNJ6KNSx_jo for inspo for nutrion idea
//video to get inspiration
// adapted from https://react.dev/reference/react/useState and https://react.dev/reference/react/useEffect
// using these hooks for the state and lifecycle control 
import { useState, useEffect } from 'react';
// adapted from https://reactrouter.com/en/main/hooks/use-navigate
// this is used for navigating between various pages
import { useNavigate, useParams } from 'react-router-dom';
// adapted from https://supabase.com/docs/guides/getting-started/tutorials/with-react
// this imports the Supabase client instance which was created in supabaseClient.js
import { supabase } from '../supabaseClient';
// imports meal suggestion data from the separate JSON file for organization
import { mealSuggestions } from '../data/mealSuggestions';

// State management for the search functionality which was adapted from React state patterns
// custom compeonent for the Nutrition Page that allows users to search for food items
// and view their nutritional information using the OpenFoodFacts API:
// https://react.dev/learn/state-a-components-memory
export default function NutritionPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [query, setQuery] = useState('');
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [dailyMeal, setDailyMeal] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  const [mealLog, setMealLog] = useState([]);

  // User profile fetch adapted from Supabase select patterns
  useEffect(() => {
    const fetchProfile = async () => {
      if (id) {
        const { data } = await supabase.from('user_profiles').select('*').eq('id', id).single();
        setProfile(data);
      }
    };
    fetchProfile();
  }, [id]);

  // Recent searches management 
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // manages meal log 
  useEffect(() => {
    const savedMealLog = localStorage.getItem('mealLog');
    if (savedMealLog) {
      setMealLog(JSON.parse(savedMealLog));
    }
  }, []);

  // Saves meal log 
  useEffect(() => {
    localStorage.setItem('mealLog', JSON.stringify(mealLog));
  }, [mealLog]);

  // Generates random daily meal combination 
  useEffect(() => {
    const randomBreakfast = mealSuggestions.morning[Math.floor(Math.random() * mealSuggestions.morning.length)];
    const randomLunch = mealSuggestions.afternoon[Math.floor(Math.random() * mealSuggestions.afternoon.length)];
    const randomDinner = mealSuggestions.evening[Math.floor(Math.random() * mealSuggestions.evening.length)];
    
    setDailyMeal({
      breakfast: randomBreakfast,
      lunch: randomLunch,
      dinner: randomDinner
    });
  }, []);

  // API integration adapted OpenFoodFacts documentation:
  // https://world.openfoodfacts.org/data and Github example https://github.com/roshanrk44/FoodData_App/tree/main
  const searchFood = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&page_size=12&json=1`
      );
      const data = await response.json();
      setFoods(data.products || []);
      
      // Updates the recent searches
      const updatedSearches = [query, ...recentSearches.filter(item => item !== query)].slice(0, 5);
      setRecentSearches(updatedSearches);
      localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
    } catch (error) {
      console.error('Search failed:', error);
      setFoods([]);
    }
    setLoading(false);
  };

  // Get goal-based description
  const getGoalDescription = () => {
    if (!profile) return 'your fitness goals';
    const goal = profile.primary_goal?.toLowerCase();
    if (goal.includes('muscle')) return 'muscle building';
    if (goal.includes('weight')) return 'weight management';
    if (goal.includes('endurance')) return 'energy and endurance';
    return 'general fitness';
  };

  // Add to daily log function adapted from https://github.com/bhprtk/dailyTracker
  const addToDailyLog = (food) => {
    const foodItem = {
      id: Date.now(), // Unique identifier for deletion
      name: food.product_name || 'Unknown Food',
      brand: food.brands || '',
      calories: food.nutriments?.['energy-kcal'] || 'N/A',
      protein: food.nutriments?.proteins || '0',
      carbs: food.nutriments?.carbohydrates || '0',
      fat: food.nutriments?.fat || '0',
      timestamp: new Date().toLocaleTimeString()
    };
    
    setMealLog(prev => [...prev, foodItem]);
    setSelectedFood(null); // Close modal after adding
  };

  // Delete from daily log function adapted from https://github.com/bhprtk/dailyTracker
  const deleteFromDailyLog = (foodId) => {
    setMealLog(prev => prev.filter(food => food.id !== foodId));
  };

  // Clear all meal logs function
  const clearAllLogs = () => {
    setMealLog([]);
  };

// below is the universal header section for the website which includes a 
// back button to return to the previous page 
// which was adapted from the referenced video https://www.youtube.com/watch?v=4PATisReKcQ  
// and https://github.com/kbuika/React-TailwindCSS-starter-with-responsive-header/blob/main/src/layout/header.js
// this header includes navigation buttons to the AI Companion and Gym Mode ,
// adapted from https://react.dev/learn/responding-to-events
  return (
    <div className="gym-body">
      <header className="gym-header">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="gym-logo">E</div>
              <h1 className="text-2xl font-bold text-white">Exervia Fitness</h1>
              <span className="gym-badge">Nutrition</span>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigate('/companion')}
                className="gym-button-primary"
              >
                AI Companion
              </button>
              <button 
                onClick={() => window.history.back()}
                className="text-gray-300 hover:text-white transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="gym-card p-8">
          {/* Daily meal suggestion section adapted from clean meal planning patterns */}
          {dailyMeal && (
            <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🍽️</span>
                <h2 className="text-xl font-bold text-white">Today's Meal Idea</h2>
              </div>
              <p className="text-gray-300 mb-4">
                A balanced day of eating for {getGoalDescription()}
              </p>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
                <span className="text-green-400 font-medium">Breakfast:</span>
                <p className="text-white">{dailyMeal.breakfast}</p>
                
                <span className="text-yellow-400 font-medium">Lunch:</span>
                <p className="text-white">{dailyMeal.lunch}</p>
                
                <span className="text-red-400 font-medium">Dinner:</span>
                <p className="text-white">{dailyMeal.dinner}</p>
              </div>
            </div>
          )}

          {/* Today's intake section adapted from simple tracking patterns */}
          {mealLog.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📝</span>
                  <h3 className="text-xl font-bold text-white">Today's Food Intake</h3>
                </div>
                <button
                  onClick={clearAllLogs}
                  className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                >
                  Clear All
                </button>
              </div>
              
              <div className="space-y-3">
                {mealLog.map((food) => (
                  <div key={food.id} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-white font-semibold">{food.name}</h4>
                        {food.brand && <p className="text-gray-400 text-sm">{food.brand}</p>}
                        <p className="text-gray-400 text-xs mt-1">Added at {food.timestamp}</p>
                      </div>
                      <button
                        onClick={() => deleteFromDailyLog(food.id)}
                        className="text-red-400 hover:text-red-300 text-lg font-bold transition-colors ml-2"
                        title="Remove item"
                      >
                        ×
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="text-center">
                        <span className="text-green-400 font-bold">{food.calories}</span>
                        <p className="text-gray-400">cal</p>
                      </div>
                      <div className="text-center">
                        <span className="text-blue-400 font-bold">{food.protein}g</span>
                        <p className="text-gray-400">protein</p>
                      </div>
                      <div className="text-center">
                        <span className="text-yellow-400 font-bold">{food.carbs}g</span>
                        <p className="text-gray-400">carbs</p>
                      </div>
                      <div className="text-center">
                        <span className="text-red-400 font-bold">{food.fat}g</span>
                        <p className="text-gray-400">fat</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent searches section  */}
          {recentSearches.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🕒</span>
                <h3 className="text-lg font-semibold text-white">Recent Searches</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setQuery(search);
                      searchFood();
                    }}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-3 py-1 rounded-full text-sm transition-colors"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🥗</div>
            <h2 className="text-3xl font-bold text-white mb-4">Nutrition Tracker</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Search for any food item of your choice to see nutritional information. Thanks to OpenFoodFacts database.
            </p>
          </div>

          {/* Food search bar with input field and search button
          handles user input and triggers API search calls adaped from
           https://react.dev/reference/react-dom/components/input and 
           https://github.com/roshanrk44/FoodData_App/tree/main  */}
          <div className="flex gap-4 mb-8">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchFood()}
              placeholder="Search for food items (e.g., banana, chicken, pasta)..."
              className="flex-1 p-4 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
            <button 
              onClick={searchFood}
              className="gym-button-primary py-3 px-8 whitespace-nowrap"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search Food'}
            </button>
          </div>

          {/* Loading state indicator adapted from common React loading patterns
          adapted using https://react.dev/learn/conditional-rendering */}
          {loading && (
            <div className="text-center py-8">
              <p className="text-gray-400">Searching OpenFoodFacts database...</p>
            </div>
          )}

        {/* Food card grid rendering nutrition details
          maps over API results and displays product info
          adapted from https://react.dev/learn/rendering-lists and
          https://github.com/roshanrk44/FoodData_App/tree/main */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {foods.map((food) => (
              <div 
                key={food.code} 
                onClick={() => setSelectedFood(food)}
                className="gym-feature-card p-6 hover:transform hover:scale-105 transition-all duration-200 cursor-pointer"
              >
                <h3 className="text-white font-bold text-lg mb-2 line-clamp-2">
                  {food.product_name || 'Unknown Food'}
                </h3>
                <p className="text-gray-400 text-sm mb-4">{food.brands}</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Calories:</span>
                    <span className="text-green-400 font-medium">{food.nutriments?.['energy-kcal'] || 'N/A'} kcal</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Protein:</span>
                    <span className="text-blue-400">{food.nutriments?.proteins || '0'}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Carbs:</span>
                    <span className="text-yellow-400">{food.nutriments?.carbohydrates || '0'}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Fat:</span>
                    <span className="text-red-400">{food.nutriments?.fat || '0'}g</span>
                  </div>
                </div>
                {/* Click indicator for detailed food information */}
                <p className="text-xs text-gray-500 mt-3 text-center">Click for detailed information →</p>
              </div>
            ))}
          </div>

          {/* Food detail modal adapted from overlay UI patterns
              displays comprehensive food information from OpenFoodFacts API */}
          {selectedFood && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
              <div className="bg-gray-900 rounded-xl p-6 max-w-lg w-full border border-gray-700 max-h-[80vh] overflow-y-auto">
                <h2 className="text-2xl font-bold text-white mb-4">
                  {selectedFood.product_name || "Unknown Food"}
                </h2>
                

                <div className="space-y-3 text-gray-300">
                  <p><span className="font-semibold text-white">Brand:</span> {selectedFood.brands || "N/A"}</p>
                  <p><span className="font-semibold text-white">Ingredients:</span> {selectedFood.ingredients_text || "Not provided"}</p>
                  <p><span className="font-semibold text-white">Allergens:</span> {selectedFood.allergens || "None listed"}</p>
                  <p><span className="font-semibold text-white">NutriScore:</span> {selectedFood.nutriscore_grade || "N/A"}</p>
                  <p><span className="font-semibold text-white">Serving Size:</span> {selectedFood.serving_size || "N/A"}</p>
                </div>

                {/* Add to daily log button adapted from simple tracking patterns */}
                <button
                  onClick={() => addToDailyLog(selectedFood)}
                  className="gym-button-primary w-full mt-6 py-3"
                >
                  Add to Today's Intake
                </button>

                <div className="flex justify-end mt-4">
                  <button 
                    onClick={() => setSelectedFood(null)}
                    className="text-gray-400 hover:text-white transition-colors px-4 py-2"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading state indicator adapted from common React loading patterns
          adapted using https://react.dev/learn/conditional-rendering  */}
          {foods.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500">Search for any food item of your choice to see nutritional information</p>
              <p className="text-gray-400 text-sm mt-2">Try searching for food items such as "banana", "chicken breast", or "pasta"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}