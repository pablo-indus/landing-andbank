const fs = require('fs');

const files = fs.readdirSync('src/components').filter(f => f.endsWith('.tsx')).map(f => 'src/components/' + f);
files.push('src/App.tsx');

const replacements = {
  'bg-white': 'bg-white dark:bg-zinc-900',
  'bg-slate-50': 'bg-slate-50 dark:bg-zinc-950',
  'bg-zinc-50': 'bg-zinc-50 dark:bg-zinc-900/50',
  'bg-zinc-100': 'bg-zinc-100 dark:bg-zinc-800',
  'bg-zinc-200': 'bg-zinc-200 dark:bg-zinc-700',
  'text-slate-900': 'text-slate-900 dark:text-zinc-50',
  'text-zinc-900': 'text-zinc-900 dark:text-zinc-100',
  'text-zinc-800': 'text-zinc-800 dark:text-zinc-200',
  'text-zinc-700': 'text-zinc-700 dark:text-zinc-300',
  'text-zinc-600': 'text-zinc-600 dark:text-zinc-400',
  'text-zinc-500': 'text-zinc-500 dark:text-zinc-400',
  'border-zinc-200': 'border-zinc-200 dark:border-zinc-700',
  'border-zinc-300': 'border-zinc-300 dark:border-zinc-600',
  'border-slate-200': 'border-slate-200 dark:border-zinc-700',
};

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  Object.keys(replacements).forEach(key => {
    const val = replacements[key];
    const regex = new RegExp(`(?<!dark:)\\b${key}\\b(?! dark:)`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, val);
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
