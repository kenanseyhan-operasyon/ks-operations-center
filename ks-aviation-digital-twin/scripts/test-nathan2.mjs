import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

fs.mkdirSync('node_modules/.cache',{recursive:true});
for(const name of ['engine','cmu-mocap','retarget-posture','playback','skin-contact','external-gate']){
 const output=`node_modules/.cache/nathan2-${name}.mjs`;
 execFileSync('node_modules/.bin/esbuild',[`tests/nathan2-${name}.test.ts`,'--bundle','--platform=node','--format=esm','--external:jsdom',`--outfile=${output}`],{stdio:'inherit'});
 execFileSync(process.execPath,[output],{stdio:'inherit'});
}
