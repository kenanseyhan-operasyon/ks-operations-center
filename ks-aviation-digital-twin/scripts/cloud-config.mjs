import {writeFileSync} from 'node:fs';
const url=(process.env.VITE_SUPABASE_URL||'').replace(/\/$/,'');
const anonKey=process.env.VITE_SUPABASE_ANON_KEY||'';
if(anonKey.startsWith('sb_secret_'))throw new Error('Never publish a Supabase secret key. Use the publishable key.');
if(anonKey.startsWith('eyJ')){const payload=JSON.parse(Buffer.from(anonKey.split('.')[1],'base64url'));if(payload.role!=='anon')throw new Error('Only the anon role key may be published.');}
if(url&&!/^https:\/\/[-a-z0-9]+\.supabase\.co$/.test(url))throw new Error('Invalid Supabase project URL.');
writeFileSync('public/cloud-config.json',JSON.stringify({url,anonKey}));
