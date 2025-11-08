// adapted from https://react.dev/reference/react/useState and https://react.dev/reference/react/useEffect
// using these hooks for the state and lifecycle control 
import { useState, useRef, useEffect } from 'react';
// imports companion response templates which I created in a separate data file for organization ,
// with inspiration from https://github.com/react-chatbotify/react-chatbotify
import { companionTemplates } from '../data/companionTemplates';

// selects one of my random response from the relevant category,
// modeled after chatbot response logic seen in https://github.com/LucasBassetti/react-simple-chatbot
const getRandomTemplate = (category) => {
  const templates = companionTemplates[category]?.default;
  return templates ? templates[Math.floor(Math.random() * templates.length)] : "I'm here to help with your fitness journey!";
};

// This is the main component responsible for rendering the Fitness Companion chat interface.
// sets up initial bot greeting using useState, useEffect, and useRef for scrolling
// adapted from https://github.com/LucasBassetti/react-simple-chatbot
//  and https://react.dev/reference/react/useState  
export default function CompanionChat() {
  const [messages, setMessages] = useState([{
    id: 1, 
    text: getRandomTemplate('greetings'),
    sender: 'bot', 
    timestamp: new Date()
  }]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
//adapted from https://react.dev/reference/react/useEffect 
// for chatbot to auto scroll to bottom when new messages are added
// similar to https://github.com/LucasBassetti/react-simple-chatbot
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

// handles user message submission and triggers bot response,
// modeled after event handling patterns from https://react.dev/learn/responding-to-events
  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    setTimeout(() => {
      const response = generateResponse(inputText);
      const botMessage = {
        id: messages.length + 2,
        text: response,
        sender: 'bot', 
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
      setIsLoading(false);
    }, 800);
  };

// gets the responses from companiontemplate.js based on keyword matching,
// inspired by other keyword based intent detection in open-source chatbot templates
  const generateResponse = (input) => {
    const lowerInput = input.toLowerCase().trim();
    
    console.log('User input:', lowerInput); // Debug log
    
    // using if statement looks for an the exact match keywords first
    if (lowerInput === 'hello' || lowerInput === 'hi' || lowerInput === 'hey') {
      return getRandomTemplate('greetings');
    }
    
    //using if statement looks for an the exact match keywords
    if (lowerInput.includes('how are you') || lowerInput.includes("how's it going")) {
      return getRandomTemplate('casual');
    }
    
    // exact key matching for now will be expandeding later
    if (lowerInput.includes('thank')) {
      return getRandomTemplate('thanks');
    }
    
    //using if statement looks for an the exact match keywords
    if (lowerInput.includes('workout','workouts') || lowerInput.includes('exercise') || lowerInput.includes('training') || lowerInput.includes('lift') || lowerInput.includes('gym')) {
      return getRandomTemplate('workout');
    }
    //using if statement looks for an the exact match keywords
    if (lowerInput.includes('nutrition') || lowerInput.includes('food') || lowerInput.includes('diet') || lowerInput.includes('eat') || lowerInput.includes('meal') || lowerInput.includes('nutrion')) {
      return getRandomTemplate('nutrition');
    }
    //using if statement looks for an the exact match keywords
    if (lowerInput.includes('motivation') || lowerInput.includes('motivated') || lowerInput.includes('tired') || lowerInput.includes('burnout') || lowerInput.includes('demotivated')) {
      return getRandomTemplate('motivation');
    }
    //using if statement looks for an the exact match keywords
    if (lowerInput.includes('recovery') || lowerInput.includes('rest') || lowerInput.includes('sleep') || lowerInput.includes('recover') || lowerInput.includes('rest day')) {
      return getRandomTemplate('recovery');
    }
    //using if statement looks for an the exact match keywords
    if (lowerInput.includes('build muscle') || lowerInput.includes('gain muscle') || lowerInput.includes('get bigger') || lowerInput.includes('muscle growth')) {
      return getRandomTemplate('muscle');
    }
    //using if statement looks for an the exact match keywords
    if (lowerInput.includes('lose weight') || lowerInput.includes('burn fat') || lowerInput.includes('weight loss') || lowerInput.includes('slim down')) {
      return getRandomTemplate('weightloss');
    }
    //using if statement looks for an the exact match keywords
    if (lowerInput.includes('strength') || lowerInput.includes('strong') || lowerInput.includes('heavy') || lowerInput.includes('power')) {
      return getRandomTemplate('strength');
    }
    
    // If nothing matches, use general category
    return getRandomTemplate('general');
  };
//below is similar to the universal header section for the website which includes a 
// back button to return to the previous page 
// which was adapted from the referenced video https://www.youtube.com/watch?v=4PATisReKcQ aroudnd
// the and https://github.com/kbuika/React-TailwindCSS-starter-with-responsive-header/blob/main/src/layout/header.js
  return (
    <div className="companion-body">
      <header className="companion-header">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="landing-logo">E</div>
              <h1 className="text-2xl font-bold text-white">ExerVia's Fitness Companion</h1>
            </div>
            <button onClick={() => window.history.back()} className="text-gray-300 hover:text-white transition-colors">
              ← Back
            </button>
          </div>
        </div>
      </header>
      {/* This is the Companion section,renders the companion chat interface with 
      header, message window, and input field,styled using Tailwind CSS and 
      structured like chat UIs seen in React chatbot templates and 
      https://github.com/LucasBassetti/react-simple-chatbot */}
      <div className="companion-chat-container">
        <div className="companion-chat-window">
          <div className="companion-messages-area">
            {messages.map((message) => (
              <div key={message.id} className={message.sender === 'user' ? 'companion-message-user' : 'companion-message-bot'}>
                <div className={message.sender === 'user' ? 'companion-message-bubble-user' : 'companion-message-bubble-bot'}>
                  <p className="companion-message-text">{message.text}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="companion-loading">
                <div className="companion-loading-dots">
                  <div className="flex space-x-2">
                    <div className="companion-dot"></div>
                    <div className="companion-dot"></div>
                    <div className="companion-dot"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
{/* This is the Companion sample display section adapted from input field designs seen in 
      https://github.com/LucasBassetti/react-simple-chatbot and chat interface patterns on
      https://tailwindui.com/components/application-ui/forms/input-groups */}
{/* below is the input area where user can type messages to the companion
      */}
          <div className="companion-input-area">
            <div className="flex space-x-4">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about workouts, nutrition, or motivation..."
                className="companion-input"
              />
              <button onClick={handleSend} className="companion-send-button">
                Send
              </button>
              {/* As mentioned above button similarly this button is  adapted and created from 
        https://react.dev/learn/responding-to-events, */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}