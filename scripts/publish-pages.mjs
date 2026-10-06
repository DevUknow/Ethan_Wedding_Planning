import {readFile,mkdir,copyFile,readdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';

// GitHub Pages main/root serves the committed root index and assets.
// Only files listed in our previous manifest are removed.
const root=process.cwd();
const manifest=path.join(root,'.pages-manifest.json');
let previous=[];
try{previous=JSON.parse(await readFile(manifest,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
if(!Array.isArray(previous)||!previous.every(file=>typeof file==='string'&&(file==='index.html'||/^assets\/[^/]+$/.test(file))))throw new Error('Invalid Pages manifest');
const assets=(await readdir(path.join(root,'dist/assets'))).sort();
const current=['index.html',...assets.map(file=>`assets/${file}`)];
await mkdir(path.join(root,'assets'),{recursive:true});
for(const file of current)await copyFile(path.join(root,'dist',file),path.join(root,file));
for(const file of previous)if(!current.includes(file))await rm(path.join(root,file),{force:true});
await writeFile(manifest,JSON.stringify(current,null,2)+'\n');
await writeFile(path.join(root,'.nojekyll'),'');
console.log('Prepared main/root Pages site: '+current.length+' files');
