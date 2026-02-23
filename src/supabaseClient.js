import { createClient } from '@supabase/supabase-js'

const supabaseUrl = String(process.env.REACT_APP_SUPABASE_URL || '').trim()
const supabaseKey = String(process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim()

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] Missing env vars. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl || 'https://example.supabase.co', supabaseKey || 'missing-key')
