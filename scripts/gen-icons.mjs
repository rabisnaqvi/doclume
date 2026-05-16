#!/usr/bin/env node
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const svgPath = resolve(root, 'assets/icon.svg');
const pngPath = resolve(root, 'packages/vscode/images/icon.png');

const svg = readFileSync(svgPath, 'utf-8');
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 128 } });
const png = resvg.render().asPng();
writeFileSync(pngPath, png);
console.log('Generated packages/vscode/images/icon.png (128×128)');
