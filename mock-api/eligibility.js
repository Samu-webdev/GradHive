const { LEVEL_RANK, LEVEL_LABEL, DOC_LABELS } = require('./data');

function fmtDate(iso) { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }

/** Vérifie les conditions d'admission d'un poste. Même logique que le backend Laravel (EligibilityService). */
function checkEligibility(position, input, today = new Date()) {
  const checks = [];
  // 1. Niveau d'études
  const have = LEVEL_RANK[input.level] || 0, need = LEVEL_RANK[position.required_level] || 0;
  checks.push({ key: 'level', label: `Niveau d’études minimum : ${LEVEL_LABEL[position.required_level]}`, ok: have >= need,
    expected: LEVEL_LABEL[position.required_level], actual: LEVEL_LABEL[input.level] || 'Non renseigné' });
  // 2. Moyenne
  const gpa = Number(input.gpa);
  checks.push({ key: 'gpa', label: `Moyenne minimale : ${position.min_average}/20`, ok: !Number.isNaN(gpa) && input.gpa !== '' && input.gpa != null && gpa >= position.min_average,
    expected: `${position.min_average}/20`, actual: input.gpa === '' || input.gpa == null || Number.isNaN(gpa) ? 'Non renseignée' : `${gpa}/20` });
  // 3. Langue
  const reqs = position.language_requirements || {};
  const tests = Object.keys(reqs);
  if (tests.length) {
    const label = 'Test de langue : ' + tests.map(t => `${t} ≥ ${reqs[t]}`).join(' ou ');
    let ok = false, actual = 'Aucun test renseigné';
    if (position.language_waiver_allowed && input.language_waiver) { ok = true; actual = 'Dispense déclarée'; }
    else if (input.language_test && input.language_score !== '' && input.language_score != null) {
      const min = reqs[input.language_test];
      actual = `${input.language_test} ${input.language_score}`;
      ok = min !== undefined && Number(input.language_score) >= min;
    }
    checks.push({ key: 'language', label, ok, expected: tests.map(t => `${t} ≥ ${reqs[t]}`).join(' ou '), actual });
  }
  // 4. Documents
  const provided = new Set(input.documents || []);
  for (const d of position.required_documents) {
    checks.push({ key: `doc_${d}`, label: `Document requis : ${DOC_LABELS[d]}`, ok: provided.has(d), expected: 'Fourni', actual: provided.has(d) ? 'Fourni' : 'Manquant' });
  }
  // 5. Date limite
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dl = new Date(position.deadline + 'T23:59:59');
  checks.push({ key: 'deadline', label: `Date limite : ${fmtDate(position.deadline)}`, ok: t <= dl, expected: fmtDate(position.deadline), actual: 'Aujourd’hui' });
  return { eligible: checks.every(c => c.ok), checks };
}
module.exports = { checkEligibility };
