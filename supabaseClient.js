// Added to load environment variables from .env
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use the service role key or anon key as appropriate

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default supabase; 