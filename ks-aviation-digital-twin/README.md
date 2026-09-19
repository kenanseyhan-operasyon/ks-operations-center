# KS Aviation Digital Twin

Browser-first bilingual portfolio and aviation operations simulation shell.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The first release deliberately uses no Cesium. Three.js owns the lightweight mapped globe, airport transitions and facility workspace. The extracted R14/38K vehicle is an external, cacheable GLB at `public/models/refueller-38k-r14.glb` and loads only when the ADB workspace is opened.
