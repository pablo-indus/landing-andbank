const strings = [
  "Agresiva +",
  "Agresiva",
  "Agresivo +",
  "Agresivo",
  "Agresivo Agresivo +",
  "Conservador",
  "Conservadora",
  "Conservador + Conservador",
  "Conservador + Conservador Moderado Equilibrado",
  "Conservador+ Conservador Moderado Equilibrado",
  "Conservador + Conservador Moderado Equilibrado Agresivo",
  "Conservador+ Conservador Moderado Equilibrado Agresivo",
  "Conservador+ Conservdor Moderado",
  "Conservador Moderada Equilibrada Agresiva",
  "Conservador Moderado",
  "Conservador Moderado Equilibrado",
  "Conservador Moderado Equilibrado Agresivo",
  " Conservador Moderado Equilibrado Agresivo Agresivo +",
  "Conservador Moderado Equilibrado Agresivo    Agresivo +",
  "Conservador Moderado Equilibrado Agresivo Agresivo+",
  "Conservdor Moderado Equilibrado Agresivo",
  "Conservdor Moderado Equilibrado Agresivo Agresivo+",
  "Equilibrada",
  "Equilibrada Agresiva",
  "Equilibrada Agresiva Agresiva +",
  "Equilibrado Agresivo",
  "Equilibrado Agresivo Agresivo +",
  "Equilibrado Agresivo Agresivo+",
  "Moderada",
  "Moderada Equilibrada",
  "Moderada Equilibrada Agresiva +",
  "Moderada Equilibrada Agresiva",
  "Moderada Equilibrada Agresiva Agresivo +",
  "Moderado Equilibrado",
  "Moderado Equilibrado Agresivo",
  "Moderado Equilibrado Agresivo Agresivo +",
  "Moderado Equilibrado Agresivo Agresivo+"
];

const parseProfiles = (metaStr) => {
    const s = metaStr.toLowerCase();
    const active = [];
    
    const consPlus = s.includes('conservador +') || s.includes('conservador+');
    const agrPlus = s.includes('agresivo +') || s.includes('agresivo+') || s.includes('agresiva +') || s.includes('agresiva+');
    
    if (consPlus) active.push(0);
    if ((s.includes('conservador') || s.includes('conservadora')) && !consPlus) active.push(1);
    if (consPlus && (s.match(/conservador.*conservador/) || s.includes('conservdor'))) active.push(1);
    if (!consPlus && s.includes('conservdor')) active.push(1); 

    if (s.includes('moderado') || s.includes('moderada')) active.push(2);
    if (s.includes('equilibrado') || s.includes('equilibrada')) active.push(3);

    if (agrPlus) active.push(5);
    if ((s.includes('agresivo') || s.includes('agresiva')) && !agrPlus) active.push(4);
    if (agrPlus && s.match(/agresiv[oa].*agresiv[oa]/)) active.push(4);
    
    return active.sort((a,b) => a - b);
}

strings.forEach(s => console.log(s, "=>", parseProfiles(s)));
