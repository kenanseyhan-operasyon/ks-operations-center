import {writeFileSync} from 'node:fs';
// Cloud publishing on the 3D site requires an explicit flag and its own Supabase project.
const test=process.env.VITE_KS_TEST_SITE==='1',shared=test&&process.env.VITE_KS_TEST_CLOUD==='1';
const url=((test?(shared?process.env.VITE_TEST_SUPABASE_URL:''):process.env.VITE_SUPABASE_URL)||'').replace(/\/$/,'');
const anonKey=test?(shared?process.env.VITE_TEST_SUPABASE_ANON_KEY||'':''):process.env.VITE_SUPABASE_ANON_KEY||'';
if(shared&&(!url||!anonKey))throw new Error('The shared 3D scene requires its dedicated Supabase URL and publishable key.');
if(anonKey.startsWith('sb_secret_'))throw new Error('Never publish a Supabase secret key. Use the publishable key.');
if(anonKey.startsWith('eyJ')){const payload=JSON.parse(Buffer.from(anonKey.split('.')[1],'base64url'));if(payload.role!=='anon')throw new Error('Only the anon role key may be published.');}
if(url&&!/^https:\/\/[-a-z0-9]+\.supabase\.co$/.test(url))throw new Error('Invalid Supabase project URL.');
writeFileSync('public/cloud-config.json',JSON.stringify({url,anonKey,...(shared?{claimEditor:true}:{})}));
