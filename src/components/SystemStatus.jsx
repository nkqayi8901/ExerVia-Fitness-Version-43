import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function SystemStatus() {
  const [userState, setUserState] = useState(null);

  const fetchUserState = async () => {
    const userId = localStorage.getItem('exervia_user_id');
    if (!userId) return;

    const { data, error } = await supabase
      .from('user_state')
      .select('fatigue_score, recovery_score, momentum_score')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('SystemStatus fetch error:', error);
      return;
    }

    setUserState(data);
  };

  useEffect(() => {
    fetchUserState();

    // 🔔 Listen for global state updates
    const handler = () => fetchUserState();
    window.addEventListener('user_state_updated', handler);
    return () => window.removeEventListener('user_state_updated', handler);
  }, []);

  if (!userState) return null;

  const {
    fatigue_score = 0,
    recovery_score = 0,
    momentum_score = 0
  } = userState;

  return (
    <div className="bg-gray-700 text-white p-4 rounded-lg shadow-md max-w-sm mx-auto mt-4">
      <h2 className="font-bold mb-2">SYSTEM STATUS</h2>

      <p className={`mb-1 ${fatigue_score > 75 ? 'text-red-500' : ''}`}>
        Fatigue: {fatigue_score}%
      </p>

      <p className={`mb-1 ${recovery_score > 60 ? 'text-green-500' : ''}`}>
        Recovery: {recovery_score}%
      </p>

      <p>
        Momentum: {momentum_score > 0 ? `+${momentum_score}` : momentum_score}
      </p>
    </div>
  );
}
