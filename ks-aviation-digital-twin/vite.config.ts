import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),'VITE_');
  const test=(process.env.VITE_KS_TEST_SITE||env.VITE_KS_TEST_SITE)==='1';
  return {plugins:[{
    name:'ks-test-site-branding',
    transformIndexHtml(html:string){
      if(!test)return html;
      return html
        .replace('<title>KS Aviation Digital Twin</title>','<title>Kenan Seyhan 3D Test</title>')
        .replace('content="KS Aviation"','content="KS 3D Test"')
        .replace('href="/manifest.webmanifest"','href="/test.webmanifest"')
        .replace('KS Aviation Digital Twin — Aviation fuel operations, 3D training and simulation.','Kenan Seyhan 3D Test — ADB tesisi, araçlar ve Nathan personel modülü geliştirme alanı.')
        .replace('</head>','<meta name="robots" content="noindex, nofollow" />\n  </head>');
    },
  }]};
});
