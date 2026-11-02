import {defineConfig, loadEnv} from 'vite';
import {resolve} from 'node:path';

export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),'VITE_');
  const test=(process.env.VITE_KS_TEST_SITE||env.VITE_KS_TEST_SITE)==='1';
  const buildLabel='Gemini test · '+(process.env.RENDER_GIT_COMMIT||'local').slice(0,8)+' · '+new Date().toISOString().slice(0,16)+'Z';
  return {plugins:[{
    name:'ks-test-site-branding',
    transformIndexHtml(html:string){
      if(!test)return html;
      return html
        .replace('<title>KS Aviation Digital Twin</title>','<title>Kenan Seyhan 3D Test</title>')
        .replace('content="KS Aviation"','content="KS 3D Test"')
        .replace('href="/manifest.webmanifest"','href="/test.webmanifest"')
        .replace('KS Aviation Digital Twin — Aviation fuel operations, 3D training and simulation.','Kenan Seyhan 3D Test — ADB tesisi, araçlar ve Nathan personel modülü geliştirme alanı.')
        .replace('</head>','<meta name="robots" content="noindex, nofollow" />\n  </head>')
        .replace('</body>','<div role="status" style="position:fixed;bottom:8px;left:8px;z-index:10000;border-radius:5px;background:#061c20db;color:#ddf4f2;font:11px system-ui;padding:5px 7px;pointer-events:none">'+buildLabel+'</div></body>');
    },
  }],build:{rollupOptions:{input:{main:resolve(process.cwd(),'index.html'),nathan2:resolve(process.cwd(),'nathan2-lab.html')}}}};
});
