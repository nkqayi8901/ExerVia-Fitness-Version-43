// This file contains predefined templates for the AI fitness companion's responses
// These templates cover various categories such as greetings, workout advice, nutrition tips, motivation, and recovery strategies
// The structure is inspired by chatbot response patterns
//often seen , the response are designed by me to fit the fitness context split into categories
// exports companionTemplates so it can be imported and used in CompanionChat.jsx
export const companionTemplates = {
  greetings: {
    default: [
      "Hello! 👋 How can I help with your fitness journey today? I can assist with workouts, nutrition, recovery, or motivation!",
      "Hi there! Ready to crush some fitness goals? What would you like to work on today?",
      "Hey! Your fitness companion is here. How can I assist with your training and nutrition?"
    ]
  },
  thanks: {
    default: [
      "You're welcome boss hehe",
      "Happy to help! Let me know if you need anything else on your fitness journey.",
      "Anytime! Feel free to ask more questions about workouts, nutrition, or recovery."
    ]
  },
  casual: {
    default: [
      "I'm doing great! Ready to help you crush your fitness goals. What would you like to work on today?",
      "Doing awesome! Excited to help you with your fitness journey. What's on your mind?",
      "I'm fantastic! Let's get you closer to your fitness goals. What can I help with?"
    ]
  },
  workout: {
    default: [
      "For effective workouts, focus on compound movements like squats, bench press, and deadlifts. Aim for 3-4 sets of 8-12 reps with proper form.",
      "Progressive overload is key! Gradually increase weight or reps each week. Track your progress to stay motivated and see improvements.",
      "Mix strength and hypertrophy training. Strength days: 3-5 reps heavy weight. Hypertrophy days: 8-12 reps moderate weight for muscle growth."
    ]
  },
  nutrition: {
    default: [
      "For muscle building, aim for 1.6-2.2g of protein per kg of body weight daily. Spread across 4-6 meals for optimal absorption.",
      "Stay hydrated! Drink 3-4 liters of water daily. Proper hydration improves performance and recovery significantly.",
      "Balance your macros: 40% protein, 40% carbs, 20% fats on training days. Adjust based on your energy needs and goals."
    ]
  },
  motivation: {
    default: [
      "Consistency beats intensity! Every workout counts. Remember why you started and celebrate small victories along the way.",
      "Progress isn't always linear. Some days will be harder than others, but showing up is what builds lasting habits. You've got this!",
      "Think of your fitness journey as a marathon, not a sprint. Small, consistent efforts compound into amazing results over time."
    ]
  },
  recovery: {
    default: [
      "Recovery is when muscles grow! Aim for 7-9 hours of quality sleep and consider active recovery like walking or light stretching.",
      "Don't skip rest days! Your body needs time to repair and strengthen. Listen to your body and adjust intensity when needed.",
      "Proper nutrition and hydration are crucial for recovery. Post-workout, focus on protein and carbs to replenish energy stores."
    ]
  },
  muscle: {
    default: [
      "For muscle building, focus on progressive overload with compound exercises. Aim for 8-12 reps per set and ensure you're eating enough protein - about 1.6-2.2g per kg of body weight daily!",
      "Muscle growth requires consistent training and proper nutrition. Focus on compound lifts and eat in a slight calorie surplus with adequate protein."
    ]
  },
  weightloss: {
    default: [
      "For weight loss, combine strength training with cardio and maintain a slight calorie deficit. Don't cut protein - it helps preserve muscle while losing fat!",
      "Sustainable weight loss comes from consistent habits: strength training 3-4x weekly, moderate cardio, and a balanced diet with adequate protein."
    ]
  },
  strength: {
    default: [
      "For strength gains, focus on lower reps (3-6) with heavier weights. Ensure proper form and allow adequate recovery between sessions!",
      "Building strength requires heavy compound lifts, proper technique, and sufficient recovery. Progressive overload is key to continuous improvement."
    ]
  },
  general: {
    default: [
      "I'm here to help with your fitness journey! Ask me about workouts, nutrition, recovery, or motivation. What's on your mind today?",
      "Whether you're focusing on strength, endurance, or general fitness, I can provide personalized advice. What are you working on?",
      "Your fitness companion is ready to assist! I can help with exercise form, meal planning, progress tracking, or just motivation."
    ]
  }
};