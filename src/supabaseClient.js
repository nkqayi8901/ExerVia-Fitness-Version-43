import { createClient } from '@supabase/supabase-js'

// adapted from https://github.com/jlumbroso/supabase-react-example/blob/main/src/supabaseClient.js 
// changed their keys to my own supabase keys which I got from my supabase project settings
const supabaseUrl = 'https://dlcmlfuakorxbibyauhl.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsY21sZnVha29yeGJpYnlhdWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MjQwNjEsImV4cCI6MjA3NjMwMDA2MX0.rphlC-4RB38kSznA-KuIwJB_FVq8puCuJg0e6q0xX3o'

export const supabase = createClient(supabaseUrl, supabaseKey)