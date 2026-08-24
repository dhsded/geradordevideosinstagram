const { Jimp } = require('jimp');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;
const fs = require('fs');
const path = require('path');

async function createIcons() {
  const sourceImage = 'C:/Users/Diego Dutra/.gemini/antigravity-ide/brain/814adf08-1e8f-4b01-ac60-b10ff86f63b4/prompter_banana_icon_1787578634054.jpg';
  const buildDir = path.join(__dirname, 'build');
  const publicDir = path.join(__dirname, 'public');

  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  console.log('Lendo imagem fonte:', sourceImage);
  const baseImg = await Jimp.read(sourceImage);

  // 512x512 PNG for high-res
  const img512 = baseImg.clone();
  img512.resize({ w: 512, h: 512 });
  await img512.write(path.join(buildDir, 'icon.png'));
  await img512.write(path.join(publicDir, 'icon.png'));

  // 256x256 PNG
  const img256 = baseImg.clone();
  img256.resize({ w: 256, h: 256 });
  const png256Path = path.join(buildDir, 'icon-256.png');
  await img256.write(png256Path);

  // Multiple sizes for high quality ICO
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngPaths = [];
  for (const s of sizes) {
    const resized = baseImg.clone();
    resized.resize({ w: s, h: s });
    const p = path.join(buildDir, `icon-${s}.png`);
    await resized.write(p);
    pngPaths.push(p);
  }

  console.log('Gerando icon.ico multi-resolução com tamanhos:', sizes.join(', '));
  const icoBuffer = await pngToIco(pngPaths);
  const icoPath = path.join(buildDir, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);

  // Clean temp size files except icon.png
  for (const s of sizes) {
    try { fs.unlinkSync(path.join(buildDir, `icon-${s}.png`)); } catch(e){}
  }

  console.log('Ícones criados com sucesso:');
  console.log(' -', path.join(buildDir, 'icon.png'));
  console.log(' -', icoPath);
}

createIcons().catch(err => {
  console.error('Erro ao gerar ícones:', err);
  process.exit(1);
});
