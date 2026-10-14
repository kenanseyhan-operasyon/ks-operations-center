/** Build-time switch only. A URL or browser storage value cannot unlock production editing. */
export const TEST_SITE = import.meta.env?.VITE_KS_TEST_SITE === '1';
export const TEST_SCENE_KEY = 'KS_3D_TEST_ADB_V1';
export const SCENE_STORAGE_KEY = TEST_SITE ? TEST_SCENE_KEY : 'KS_DIGITAL_TWIN_ADB_V1';
export const TEST_SITE_NAME = 'Kenan Seyhan 3D Test';
