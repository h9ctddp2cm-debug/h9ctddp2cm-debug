import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sources=JSON.parse(fs.readFileSync(path.join(root,'image-sources.json'),'utf8'));

test('six attributed Tsuen Wan photo-card assets are local and compact',()=>{
  assert.equal(sources.images.length,6);
  for(const image of sources.images){
    assert.match(image.local_path,/^img\/advanced\/tsuenwan_.*\.jpg$/);
    const file=path.join(root,image.local_path);
    assert.equal(fs.existsSync(file),true,image.local_path);
    assert.ok(fs.statSync(file).size<180000,image.local_path+' should remain tablet-friendly');
    assert.match(image.source_url,/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.match(image.license_url,/^https:\/\/creativecommons\.org\//);
    assert.ok(image.author&&image.license);
  }
});

test('photo cards and targets use local paths, readable labels, alt text and in-app credits',()=>{
  assert.match(html,/id:'tsuenwan',title:'荃灣街景相片'/);
  assert.match(html,/把荃灣街景相片送到同名的大型相片目標/);
  assert.match(html,/thumbnail:'img\/advanced\/tsuenwan_market_street\.jpg'/);
  assert.match(html,/thumbnailAlt:'荃灣街市街真實街景相片'/);
  assert.match(html,/drawTsuenWanPhotoCard/);
  assert.match(html,/圖片來源 \/ Image credits/);
  assert.match(html,/href="image-sources\.json"/);
  assert.doesNotMatch(html,/new Image\(\);\s*img\.src\s*=\s*['"]https:\/\/upload\.wikimedia/);
});

test('public build copies the attribution file and image directory for offline use',()=>{
  const build=fs.readFileSync(path.join(root,'scripts/build-dist.sh'),'utf8');
  assert.match(build,/cp -R "\$ROOT\/img" "\$DIST\/img"/);
  assert.match(build,/cp "\$ROOT\/image-sources\.json" "\$DIST\/image-sources\.json"/);
});
