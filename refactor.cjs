const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, 'src', 'components', 'Dashboard.tsx'),
  path.join(__dirname, 'src', 'components', 'PrestamoDetalle.tsx'),
  path.join(__dirname, 'src', 'components', 'Login.tsx')
];

function processFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace backgrounds
  content = content.replace(/bg-slate-900\/40/g, 'bg-white/[0.02]');
  content = content.replace(/bg-slate-900\/80/g, 'bg-black/40');
  content = content.replace(/bg-slate-800\/50/g, 'bg-white/[0.03]');
  content = content.replace(/bg-slate-900/g, 'bg-[#0A0A0C]');
  content = content.replace(/bg-slate-950\/20/g, 'bg-white/[0.02]');
  content = content.replace(/bg-slate-950\/40/g, 'bg-white/[0.04]');
  content = content.replace(/bg-slate-950\/70/g, 'bg-white/[0.03]');
  content = content.replace(/bg-slate-950/g, 'bg-black');
  
  // Replace borders
  content = content.replace(/border-slate-800\/50/g, 'border-white/5');
  content = content.replace(/border-white\/10/g, 'border-white/5');

  // Remove neon glow shadows and intense borders
  content = content.replace(/shadow-\[0_0_8px_rgba\([^)]+\)\]/g, 'shadow-sm');
  content = content.replace(/shadow-\[0_0_15px_rgba\([^)]+\)\]/g, 'shadow-md');
  content = content.replace(/shadow-indigo-500\/20/g, 'shadow-black/20');
  content = content.replace(/shadow-emerald-500\/20/g, 'shadow-black/20');
  
  // Replace text colors
  content = content.replace(/text-slate-400/g, 'text-gray-400');
  content = content.replace(/text-slate-500/g, 'text-gray-500');
  content = content.replace(/text-slate-300/g, 'text-gray-300');
  content = content.replace(/text-indigo-400/g, 'text-blue-400');
  content = content.replace(/text-emerald-400/g, 'text-green-400');
  content = content.replace(/text-rose-400/g, 'text-red-400');

  // Remove animate-pulse
  content = content.replace(/animate-pulse/g, '');

  // Replace glow-btn with standard sober button styling
  content = content.replace(/glow-btn/g, 'bg-white/10 hover:bg-white/15 border border-white/10 backdrop-blur-md transition-all text-white font-medium');
  content = content.replace(/bg-indigo-500\/10/g, 'bg-blue-500/10');
  content = content.replace(/border-indigo-500\/20/g, 'border-blue-500/20');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed ${filePath}`);
}

targetFiles.forEach(processFile);
