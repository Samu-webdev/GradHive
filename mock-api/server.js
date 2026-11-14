const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const { universities, positions, DOC_LABELS } = require('./data');
const { checkEligibility } = require('./eligibility');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.use(cors());
app.use(express.json());

const ROLES = ['student', 'school', 'company', 'mentor', 'organization'];
let seq = { user: 1, work: 1, app: 1, conn: 1, highlight: 1 };
const connections = [];
const users = [], tokens = new Map(), tokenExpiries = new Map(), works = [], applications = [], files = new Map(), highlights = [];

function pdfBuffer(text) {
  const s = `%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 100]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 60>>stream\nBT /F1 12 Tf 20 50 Td (${text.replace(/[()\\]/g, '')}) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`;
  return Buffer.from(s);
}
const pub = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, country: u.country, institution: u.institution, field_of_study: u.field_of_study, level: u.level, headline: u.headline || null, bio: u.bio || null, website: u.website || null, joined_at: u.joined_at });
const card = u => ({ id: u.id, name: u.name, role: u.role, country: u.country, institution: u.institution, field_of_study: u.field_of_study, level: u.level, headline: u.headline || null, joined_at: u.joined_at });
let seedDay = 0;
function addUser(o) {
  const u = {
    id: seq.user++, status: 'active', joined_at: new Date(Date.now() - (seedDay++) * 36e5 * 7).toISOString(),
    ...(o.role === 'student' ? { student_profile_visibility: 'private' } : {}),
    ...(o.role === 'school' ? { institution_profile_visibility: 'public' } : {}),
    ...o,
  };
  users.push(u);
  return u;
}
const student = addUser({ name: 'Jorres', email: 'student@gradhive.test', password: 'password', role: 'student', country: 'Sénégal', institution: "SUP'INFO Dakar", field_of_study: 'Informatique', level: 'master', student_profile_visibility: 'public', headline: 'Master en génie logiciel · Passionnée d’IA appliquée à l’éducation', bio: 'Je conçois des plateformes qui rapprochent les étudiants africains des opportunités internationales.' });
addUser({ name: "SUP'INFO Dakar", email: 'school@gradhive.test', password: 'password', role: 'school', country: 'Sénégal', institution: "SUP'INFO Dakar", headline: 'Établissement d’enseignement supérieur · Dakar', bio: 'Formation en informatique et systèmes d’information, de la licence au master.', website: 'https://example.org/supinfo' });
addUser({ name: 'Administrateur GradHive', email: 'admin@gradhive.test', password: 'password', role: 'admin', country: 'Sénégal' });
// Profils de démonstration pour animer le réseau (fictifs)
[
  ['Moussa Fall', 'student', 'Sénégal', "SUP'INFO Dakar", 'Systèmes d’information', 'licence', 'Licence 3 · Gestion des stocks et PME'],
  ['Awa Sarr', 'student', 'Sénégal', "SUP'INFO Dakar", 'Santé numérique', 'master', 'Master 2 · Applications mobiles de santé'],
  ['Ibrahima Ba', 'student', 'Sénégal', 'Institut Teranga de Technologie', 'Réseaux et sécurité', 'doctorat', 'Doctorant · Cybersécurité des réseaux d’entreprise'],
  ['Fatou Gueye', 'student', 'Côte d’Ivoire', 'Université Baobab', 'Systèmes d’information', 'licence', 'Licence 3 · Archivage numérique'],
  ['Institut Teranga de Technologie', 'school', 'Sénégal', 'Institut Teranga de Technologie', null, null, 'École d’ingénieurs · Thiès (profil de démonstration)'],
  ['Université Baobab', 'school', 'Côte d’Ivoire', 'Université Baobab', null, null, 'Université pluridisciplinaire · Abidjan (profil de démonstration)'],
  ['Sahel Digital', 'company', 'Sénégal', 'Sahel Digital', null, null, 'Éditeur de logiciels · recrute des jeunes diplômés (profil de démonstration)'],
  ['Baobab Labs', 'company', 'Mali', 'Baobab Labs', null, null, 'Studio de développement mobile (profil de démonstration)'],
  ['Fondation Horizon Afrique', 'organization', 'Sénégal', 'Fondation Horizon Afrique', null, null, 'ONG · bourses d’excellence pour jeunes chercheurs (profil de démonstration)'],
  ['Savoirs Partagés', 'organization', 'Bénin', 'Savoirs Partagés', null, null, 'ONG · accès à l’éducation numérique (profil de démonstration)'],
  ['Dr Mariama Sow', 'mentor', 'Canada', null, null, null, 'Chercheuse en apprentissage automatique · Montréal (profil de démonstration)'],
].forEach(([name, role, country, institution, field, level, headline], i) => addUser({ name, role, country, institution, field_of_study: field, level, headline, student_profile_visibility: role === 'student' ? 'public' : undefined, email: `demo${i}@gradhive.test`, password: 'password'}));

[
  ['Conception d’une plateforme de mentorat pour étudiants africains', 'Étude et réalisation d’une application web et mobile reliant étudiants et mentors de la diaspora.', 'Génie logiciel', 'master', 2025, 'tres_bien', ['mentorat', 'Laravel', 'Angular']],
  ['Système de gestion intelligente des stocks pour PME sénégalaises', 'Conception d’un outil de prévision des ruptures de stock à partir de données de ventes.', 'Systèmes d’information', 'licence', 2024, 'bien', ['stocks', 'prévision', 'PME']],
  ['Application mobile de suivi de la santé maternelle en zone rurale', 'Application Flutter fonctionnant hors ligne pour le suivi des consultations prénatales.', 'Santé numérique', 'master', 2025, 'bien', ['Flutter', 'santé', 'hors ligne']],
  ['Détection d’intrusions réseau par apprentissage automatique', 'Comparaison de modèles de classification pour détecter les attaques sur un réseau d’entreprise.', 'Réseaux et sécurité', 'master', 2023, 'assez_bien', ['sécurité', 'machine learning']],
  ['Digitalisation de l’archivage des mémoires dans l’enseignement supérieur', 'Analyse des pratiques d’archivage papier et proposition d’une archive numérique.', 'Systèmes d’information', 'licence', 2024, 'assez_bien', ['archivage', 'mémoires']],
  ['Plateforme de paiement mobile pour les marchés de proximité', 'Intégration de moyens de paiement mobile dans une application de commerce local.', 'Commerce électronique', 'licence', 2023, 'passable', ['paiement mobile', 'e-commerce']],
].forEach(([title, abstract, theme, level, year, mention, keywords], i) => {
  const author = users.find(u => u.name === ['Jorres', 'Moussa Fall', 'Awa Sarr', 'Ibrahima Ba', 'Fatou Gueye', 'Jorres'][i]);
  const w = { id: seq.work++, title, abstract, theme, level, year, mention, type: 'project', visibility: 'public', supervisor: 'Dr Ndiaye', keywords, author_id: author.id, author_name: author.name, institution: author.institution, file_name: 'memoire.pdf', views: 10 * (i + 1), created_at: new Date(Date.now() - i * 864e5).toISOString() };
  works.push(w); files.set(w.id, pdfBuffer(title.slice(0, 40)));
});

const err = (res, status, message, errors) => res.status(status).json(errors ? { message, errors } : { message });
function auth(req, res, next) {
  const u = tokenUser(req);
  if (!u) return err(res, 401, 'Non authentifié.');
  if (u.status !== 'active') return err(res, 403, 'Votre compte est suspendu.');
  req.user = u; next();
}
function tokenUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  const u = tokens.get(token);
  const expiresAt = tokenExpiries.get(token);
  if (!u || (expiresAt && expiresAt <= Date.now())) {
    tokens.delete(token); tokenExpiries.delete(token);
    return null;
  }
  return u;
}
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header) return next();
  const u = tokenUser(req);
  if (!u) return err(res, 401, 'Non authentifié.');
  if (u.status !== 'active') return err(res, 403, 'Votre compte est suspendu.');
  req.user = u;
  next();
}
const role = (...r) => (req, res, next) => r.includes(req.user.role) ? next() : err(res, 403, 'Action non autorisée pour votre rôle.');
const issue = u => {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 8 * 3600e3);
  tokens.set(token, u);
  tokenExpiries.set(token, expiresAt.getTime());
  return { token, expires_at: expiresAt.toISOString() };
};
const session = u => ({ user: pub(u), ...issue(u) }); // comme l'API Laravel (TOKEN_TTL_MINUTES)

// ---------- Authentification ----------
app.post('/api/register', (req, res) => {
  const b = req.body, e = {};
  if (!b.name || b.name.trim().length < 2) e.name = ['Le nom est obligatoire.'];
  if (!/^\S+@\S+\.\S+$/.test(b.email || '')) e.email = ['Adresse e-mail invalide.'];
  else if (users.some(u => u.email === b.email.toLowerCase())) e.email = ['Cette adresse e-mail est déjà utilisée.'];
  if (!b.password || b.password.length < 8) e.password = ['Le mot de passe doit contenir au moins 8 caractères.'];
  else if (b.password !== b.password_confirmation) e.password = ['La confirmation du mot de passe ne correspond pas.'];
  if (!ROLES.includes(b.role)) e.role = ['Rôle invalide.'];
  if (!b.country) e.country = ['Le pays est obligatoire.'];
  if (b.role && b.role !== 'mentor' && !b.institution) e.institution = ['Ce champ est obligatoire pour ce rôle.'];
  if (b.role === 'student') {
    if (!['licence', 'master', 'doctorat'].includes(b.level)) e.level = ['Niveau invalide.'];
    if (!b.field_of_study) e.field_of_study = ['La filière est obligatoire.'];
  }
  if (Object.keys(e).length) return err(res, 422, 'Les données fournies sont invalides.', e);
  const u = addUser({ name: b.name.trim(), email: b.email.toLowerCase(), password: b.password, role: b.role, country: b.country, institution: b.institution || null, field_of_study: b.field_of_study || null, level: b.level || null, joined_at: new Date().toISOString() });
  res.status(201).json({ message: 'Compte créé.', ...session(u) });
});
app.post('/api/login', (req, res) => {
  const u = users.find(x => x.email === (req.body.email || '').toLowerCase() && x.password === req.body.password);
  if (!u) return err(res, 422, 'Identifiants incorrects.', { email: ['Identifiants incorrects.'] });
  if (u.status === 'suspended') return err(res, 403, 'Votre compte est suspendu.');
  res.json(session(u));
});
app.post('/api/logout', auth, (req, res) => {
  const token = (req.headers.authorization || '').slice(7);
  tokens.delete(token); tokenExpiries.delete(token);
  res.json({ message: 'Déconnecté.' });
});
app.get('/api/me', auth, (req, res) => res.json({ user: pub(req.user) }));
app.patch('/api/me/profile', auth, (req, res) => {
  const b = req.body, e = {}, u = req.user;
  if (b.headline !== undefined && String(b.headline).length > 120) e.headline = ['120 caractères maximum.'];
  if (b.bio !== undefined && String(b.bio).length > 1000) e.bio = ['1 000 caractères maximum.'];
  if (b.website && !/^https?:\/\/\S+\.\S+/.test(b.website)) e.website = ['L’adresse du site doit commencer par http:// ou https://.'];
  if (b.level && !['licence', 'master', 'doctorat'].includes(b.level)) e.level = ['Niveau invalide.'];
  if (Object.keys(e).length) return err(res, 422, 'Les données fournies sont invalides.', e);
  for (const k of ['headline', 'bio', 'website', 'country', 'institution', 'field_of_study', 'level']) if (b[k] !== undefined) u[k] = b[k] || null;
  res.json({ message: 'Profil mis à jour.', user: pub(u) });
});
const profileOut = (u, owner = false) => ({
  id: u.id, name: u.name, role: u.role, country: u.country || null, headline: u.headline || null,
  bio: u.bio || null, website: u.website || null, joined_at: u.joined_at, institution: u.institution || null,
  ...(u.role === 'student' ? { field_of_study: u.field_of_study || null, level: u.level || null } : {}),
  ...(owner ? { profile_visibility: u.role === 'student' ? u.student_profile_visibility : u.institution_profile_visibility } : {}),
});
const highlightOut = item => ({
  id: item.id, student_id: item.student_id, student_name: users.find(u => u.id === item.student_id)?.name,
  title: item.title, message: item.message,
});
const mayHighlight = (school, s) =>
  s && s.role === 'student' && s.student_profile_visibility === 'public' &&
  String(s.institution || '').trim().toLowerCase() === String(school.institution || '').trim().toLowerCase();
app.get('/api/my/profile', auth, role('student', 'school'), (req, res) => res.json({ data: profileOut(req.user, true) }));
app.patch('/api/my/profile', auth, role('student', 'school'), (req, res) => {
  const b = req.body, e = {}, u = req.user;
  for (const k of ['name', 'country', 'headline', 'bio', 'website']) {
    if (b[k] !== undefined && String(b[k]).length > ({ name: 120, country: 80, headline: 120, bio: 5000, website: 255 }[k])) e[k] = ['Valeur invalide.'];
  }
  if (b.name !== undefined && String(b.name).trim().length < 2) e.name = ['Le nom doit contenir au moins 2 caractères.'];
  if (b.website && !/^https?:\/\/\S+\.\S+/.test(b.website)) e.website = ['L’adresse du site doit commencer par http:// ou https://.'];
  if (u.role === 'student') {
    for (const k of ['institution', 'field_of_study']) if (b[k] !== undefined && String(b[k]).length > (k === 'institution' ? 150 : 120)) e[k] = ['Valeur invalide.'];
    if (b.level !== undefined && b.level !== null && b.level !== '' && !['licence', 'master', 'doctorat'].includes(b.level)) e.level = ['Niveau invalide.'];
    if (b.student_profile_visibility !== undefined && !['private', 'public'].includes(b.student_profile_visibility)) e.student_profile_visibility = ['Visibilité invalide.'];
  } else {
    if (b.institution !== undefined && String(b.institution).length > 150) e.institution = ['Valeur invalide.'];
    if (b.institution_profile_visibility !== undefined && !['private', 'public'].includes(b.institution_profile_visibility)) e.institution_profile_visibility = ['Visibilité invalide.'];
  }
  if (Object.keys(e).length) return err(res, 422, 'Les données fournies sont invalides.', e);
  for (const k of ['name', 'country', 'headline', 'bio', 'website', 'institution', 'field_of_study', 'level', 'student_profile_visibility', 'institution_profile_visibility']) {
    if (b[k] !== undefined) u[k] = b[k] || null;
  }
  res.json({ message: 'Profil mis à jour.', data: profileOut(u, true) });
});
app.get('/api/students/:id/profile', optionalAuth, (req, res) => {
  const u = users.find(user => user.id === Number(req.params.id) && user.role === 'student');
  if (!u || (u.student_profile_visibility !== 'public' && req.user?.id !== u.id)) return err(res, 404, 'Profil introuvable.');
  res.json({ data: profileOut(u) });
});
app.get('/api/institutions/:id/profile', (req, res) => {
  const u = users.find(user => user.id === Number(req.params.id) && user.role === 'school' && user.institution_profile_visibility !== 'private');
  if (!u) return err(res, 404, 'Profil introuvable.');
  const list = highlights.filter(item => item.institution_id === u.id && mayHighlight(u, users.find(s => s.id === item.student_id))).sort((a, b) => a.sort_order - b.sort_order);
  res.json({ data: { ...profileOut(u), highlights: list.map(highlightOut) } });
});
app.get('/api/my/institution/eligible-students', auth, role('school'), (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  const list = users.filter(u => mayHighlight(req.user, u) && (!query || [u.name, u.field_of_study, u.headline].join(' ').toLowerCase().includes(query)));
  res.json({ data: list.slice(0, 50).map(u => ({ id: u.id, name: u.name, country: u.country || null, institution: u.institution || null, field_of_study: u.field_of_study || null, level: u.level || null, headline: u.headline || null })) });
});
app.get('/api/my/institution/highlights', auth, role('school'), (req, res) =>
  res.json({ data: highlights.filter(item => item.institution_id === req.user.id).sort((a, b) => a.sort_order - b.sort_order).map(highlightOut) }));
app.post('/api/my/institution/highlights', auth, role('school'), (req, res) => {
  const b = req.body, s = users.find(u => u.id === Number(b.student_id));
  if (!Number.isInteger(Number(b.student_id)) || !s || !mayHighlight(req.user, s)) return err(res, 422, 'Seuls les étudiants affiliés ayant rendu leur profil public peuvent être mis en avant.');
  if (typeof b.title !== 'string' || b.title.trim().length < 2 || b.title.trim().length > 120) return err(res, 422, 'Les données fournies sont invalides.', { title: ['Le titre doit contenir de 2 à 120 caractères.'] });
  if (typeof b.message !== 'string' || b.message.trim().length < 10 || b.message.trim().length > 1000) return err(res, 422, 'Les données fournies sont invalides.', { message: ['La présentation doit contenir de 10 à 1 000 caractères.'] });
  if (highlights.some(item => item.institution_id === req.user.id && item.student_id === s.id)) return err(res, 409, 'Cet étudiant est déjà mis en avant.');
  const item = { id: seq.highlight++, institution_id: req.user.id, student_id: s.id, title: b.title.trim(), message: b.message.trim(), sort_order: highlights.filter(x => x.institution_id === req.user.id).length };
  highlights.push(item);
  res.status(201).json({ message: 'Mise en avant créée.', data: highlightOut(item) });
});
app.patch('/api/my/institution/highlights/order', auth, role('school'), (req, res) => {
  const ids = req.body.ids;
  const own = highlights.filter(item => item.institution_id === req.user.id);
  if (!Array.isArray(ids) || ids.length !== own.length || new Set(ids).size !== own.length || ids.some(id => !own.some(item => item.id === Number(id)))) return err(res, 422, 'La liste doit contenir exactement vos mises en avant.');
  ids.forEach((id, index) => { own.find(item => item.id === Number(id)).sort_order = index; });
  res.json({ message: 'Ordre des mises en avant mis à jour.' });
});
app.put('/api/my/institution/highlights/:id', auth, role('school'), (req, res) => {
  const item = highlights.find(x => x.id === Number(req.params.id) && x.institution_id === req.user.id);
  if (!item) return err(res, 404, 'Mise en avant introuvable.');
  for (const k of ['title', 'message']) {
    if (req.body[k] !== undefined) {
      const value = String(req.body[k]).trim(), min = k === 'title' ? 2 : 10, max = k === 'title' ? 120 : 1000;
      if (value.length < min || value.length > max) return err(res, 422, 'Les données fournies sont invalides.', { [k]: [`Longueur invalide (${min}–${max}).`] });
      item[k] = value;
    }
  }
  res.json({ message: 'Mise en avant mise à jour.', data: highlightOut(item) });
});
app.delete('/api/my/institution/highlights/:id', auth, role('school'), (req, res) => {
  const index = highlights.findIndex(x => x.id === Number(req.params.id) && x.institution_id === req.user.id);
  if (index < 0) return err(res, 404, 'Mise en avant introuvable.');
  highlights.splice(index, 1);
  highlights.filter(x => x.institution_id === req.user.id).forEach((item, order) => { item.sort_order = order; });
  res.json({ message: 'Mise en avant supprimée.' });
});

// ---------- Statistiques ----------
app.get('/api/stats', (req, res) => res.json({ works: works.length, universities: universities.length, positions: positions.length, users: users.filter(u => u.role !== 'admin').length }));

// ---------- Travaux académiques : publication directe (la validation académique reste dans les universités) ----------
const workOut = (w, withFile) => ({ id: w.id, title: w.title, abstract: w.abstract, theme: w.theme, level: w.level, year: w.year, mention: w.mention, supervisor: w.supervisor, type: w.type, visibility: w.visibility, keywords: w.keywords, author_id: w.author_id, author_name: w.author_name, institution: w.institution, views: w.views, created_at: w.created_at, file_available: Boolean(w.file_name), ...(withFile ? { file_name: w.file_name } : {}) });
app.get('/api/works', optionalAuth, (req, res) => {
  const { q, year, level, mention, author_id, type, visibility, institution, field_of_study } = req.query;
  let list = works.filter(w => w.visibility === 'public' || w.author_id === req.user?.id);
  if (author_id) list = list.filter(w => String(w.author_id) === String(author_id));
  if (q) { const s = q.toLowerCase(); list = list.filter(w => [w.title, w.abstract, w.theme, w.author_name, ...w.keywords].join(' ').toLowerCase().includes(s)); }
  if (year) list = list.filter(w => String(w.year) === String(year));
  if (level) list = list.filter(w => w.level === level);
  if (mention) list = list.filter(w => w.mention === mention);
  if (type) list = list.filter(w => w.type === type);
  if (visibility) list = list.filter(w => w.visibility === visibility);
  if (institution) list = list.filter(w => String(w.institution || '').toLowerCase().includes(String(institution).toLowerCase()));
  if (field_of_study) list = list.filter(w => String(users.find(u => u.id === w.author_id)?.field_of_study || '').toLowerCase().includes(String(field_of_study).toLowerCase()));
  list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  res.json({ data: list.map(w => workOut(w)), meta: { total: list.length } });
});
app.get('/api/my/works', auth, role('student'), (req, res) => res.json({ data: works.filter(w => w.author_id === req.user.id).map(w => workOut(w, true)).reverse() }));
app.post('/api/works', auth, role('student'), upload.single('file'), (req, res) => {
  const b = req.body, e = {};
  if (!b.title || b.title.trim().length < 5) e.title = ['Le titre est obligatoire (5 caractères minimum).'];
  if (!b.abstract || b.abstract.trim().length < 30) e.abstract = ['Le résumé est obligatoire (30 caractères minimum).'];
  if (!b.theme) e.theme = ['Le thème est obligatoire.'];
  if (!['licence', 'master', 'doctorat'].includes(b.level)) e.level = ['Niveau invalide.'];
  const y = Number(b.year); if (!y || y < 1990 || y > new Date().getFullYear() + 1) e.year = ['Année invalide.'];
  const keywords = (b.keywords || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!keywords.length) e.keywords = ['Au moins un mot-clé est obligatoire.'];
  if (b.type && !['project', 'thesis', 'dissertation', 'publication', 'portfolio'].includes(b.type)) e.type = ['Type de travail invalide.'];
  if (b.visibility && !['public', 'private'].includes(b.visibility)) e.visibility = ['Visibilité invalide.'];
  if (!req.file) e.file = ['Le fichier PDF est obligatoire.'];
  else if (req.file.mimetype !== 'application/pdf' || !req.file.buffer.subarray(0, 5).toString().startsWith('%PDF-')) e.file = ['Le fichier doit être au format PDF.'];
  if (Object.keys(e).length) return err(res, 422, 'Les données fournies sont invalides.', e);
  const w = { id: seq.work++, title: b.title.trim(), abstract: b.abstract.trim(), theme: b.theme, level: b.level, year: y, mention: b.mention || null, supervisor: b.supervisor || null, type: b.type || 'project', visibility: b.visibility || 'public', keywords, author_id: req.user.id, author_name: req.user.name, institution: req.user.institution, file_name: req.file.originalname, views: 0, created_at: new Date().toISOString() };
  works.push(w); files.set(w.id, req.file.buffer);
  res.status(201).json({ message: 'Votre projet est en ligne : le réseau peut le découvrir !', data: workOut(w, true) });
});
app.put('/api/works/:id', auth, role('student'), upload.single('file'), (req, res) => {
  const w = works.find(x => x.id === Number(req.params.id));
  if (!w) return err(res, 404, 'Travail introuvable.');
  if (w.author_id !== req.user.id) return err(res, 403, 'Action non autorisée.');
  const b = req.body, e = {};
  const rules = { title: [5, 250], abstract: [30, 20000], theme: [1, 100], supervisor: [0, 120] };
  for (const [field, [min, max]] of Object.entries(rules)) if (b[field] !== undefined && String(b[field]).length > max || b[field] !== undefined && min && String(b[field]).trim().length < min) e[field] = ['Valeur invalide.'];
  if (b.level && !['licence', 'master', 'doctorat'].includes(b.level)) e.level = ['Niveau invalide.'];
  if (b.type && !['project', 'thesis', 'dissertation', 'publication', 'portfolio'].includes(b.type)) e.type = ['Type de travail invalide.'];
  if (b.visibility && !['public', 'private'].includes(b.visibility)) e.visibility = ['Visibilité invalide.'];
  if (b.year !== undefined && (Number(b.year) < 1990 || Number(b.year) > new Date().getFullYear() + 1)) e.year = ['Année invalide.'];
  if (b.keywords !== undefined && !(b.keywords || '').split(',').some(k => k.trim())) e.keywords = ['Au moins un mot-clé est obligatoire.'];
  if (req.file && (req.file.mimetype !== 'application/pdf' || !req.file.buffer.subarray(0, 5).toString().startsWith('%PDF-'))) e.file = ['Le fichier doit être au format PDF.'];
  if (Object.keys(e).length) return err(res, 422, 'Les données fournies sont invalides.', e);
  for (const field of ['title', 'abstract', 'theme', 'level', 'mention', 'supervisor', 'type', 'visibility']) if (b[field] !== undefined) w[field] = b[field] || null;
  if (b.year !== undefined) w.year = Number(b.year);
  if (b.keywords !== undefined) w.keywords = b.keywords.split(',').map(k => k.trim()).filter(Boolean);
  if (req.file) { w.file_name = req.file.originalname; files.set(w.id, req.file.buffer); }
  res.json({ message: 'Travail mis à jour.', data: workOut(w, true) });
});
app.delete('/api/works/:id', auth, role('student'), (req, res) => {
  const index = works.findIndex(x => x.id === Number(req.params.id));
  if (index < 0) return err(res, 404, 'Travail introuvable.');
  if (works[index].author_id !== req.user.id) return err(res, 403, 'Action non autorisée.');
  files.delete(works[index].id); works.splice(index, 1);
  res.json({ message: 'Travail supprimé.' });
});
app.get('/api/works/:id', optionalAuth, (req, res) => {
  const w = works.find(x => x.id === Number(req.params.id));
  if (!w) return err(res, 404, 'Travail introuvable.');
  if (w.visibility !== 'public' && w.author_id !== req.user?.id) return err(res, 404, 'Travail introuvable.');
  w.views++; res.json({ data: workOut(w) });
});
app.get('/api/works/:id/download', optionalAuth, (req, res) => {
  const w = works.find(x => x.id === Number(req.params.id));
  if (!w) return err(res, 404, 'Travail introuvable.');
  if (w.visibility !== 'public' && w.author_id !== req.user?.id) return err(res, 404, 'Travail introuvable.');
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="work-${w.id}.pdf"` }).send(files.get(w.id));
});

// ---------- Réseau : annuaire, profils, connexions, fil ----------
function connState(me, other) {
  if (!me) return 'none';
  if (me.id === other.id) return 'self';
  const c = connections.find(x => (x.a === me.id && x.b === other.id) || (x.a === other.id && x.b === me.id));
  if (!c) return 'none';
  if (c.status === 'accepted') return 'connected';
  return c.a === me.id ? 'pending_out' : 'pending_in';
}
const optAuth = req => {
  const user = tokenUser(req);
  return user?.status === 'active' ? user : null;
};
const connCount = u => connections.filter(c => c.status === 'accepted' && (c.a === u.id || c.b === u.id)).length;
app.get('/api/members', (req, res) => {
  const { role: r, q, country, level } = req.query; const me = optAuth(req);
  let list = users.filter(u => u.role !== 'admin' && u.status === 'active' &&
    (u.role !== 'student' || u.student_profile_visibility === 'public') &&
    (u.role !== 'school' || u.institution_profile_visibility !== 'private'));
  if (r) list = list.filter(u => u.role === r);
  if (level) list = list.filter(u => u.level === level);
  if (country) list = list.filter(u => u.country === country);
  if (q) { const s = q.toLowerCase(); list = list.filter(u => [u.name, u.institution, u.field_of_study, u.headline, u.country].join(' ').toLowerCase().includes(s)); }
  list.sort((a, b) => b.joined_at.localeCompare(a.joined_at));
  res.json({ data: list.map(u => ({ ...card(u), connection: connState(me, u) })), meta: { total: list.length } });
});
app.get('/api/members/:id', (req, res) => {
  const u = users.find(x => x.id === Number(req.params.id) && x.role !== 'admin');
  if (!u || u.status !== 'active' || (u.role === 'student' && u.student_profile_visibility !== 'public') || (u.role === 'school' && u.institution_profile_visibility === 'private')) return err(res, 404, 'Profil introuvable.');
  const me = optAuth(req);
  const mine = works.filter(w => w.author_id === u.id && (w.visibility === 'public' || me?.id === u.id)).map(w => workOut(w));
  const members = u.role === 'school' ? users.filter(x => x.id !== u.id && x.student_profile_visibility === 'public' && x.institution && x.institution.toLowerCase() === (u.institution || '').toLowerCase()).map(card) : [];
  res.json({ data: { ...card(u), bio: u.bio || null, website: u.website || null, works: mine, members, connections_count: connCount(u), connection: connState(me, u) } });
});
app.get('/api/connections', auth, (req, res) => {
  const me = req.user, by = id => users.find(u => u.id === id);
  const out = { accepted: [], incoming: [], outgoing: [] };
  for (const c of connections) {
    if (c.a !== me.id && c.b !== me.id) continue;
    const other = by(c.a === me.id ? c.b : c.a);
    const item = { id: c.id, user: card(other), since: c.created_at };
    if (c.status === 'accepted') out.accepted.push(item); else if (c.a === me.id) out.outgoing.push(item); else out.incoming.push(item);
  }
  res.json(out);
});
app.post('/api/connections', auth, (req, res) => {
  const other = users.find(u => u.id === Number(req.body.user_id) && u.role !== 'admin');
  if (!other) return err(res, 404, 'Profil introuvable.');
  if (other.id === req.user.id) return err(res, 422, 'Vous ne pouvez pas vous connecter à vous-même.');
  const ex = connections.find(c => (c.a === req.user.id && c.b === other.id) || (c.a === other.id && c.b === req.user.id));
  if (ex) {
    if (ex.status === 'pending' && ex.b === req.user.id) { ex.status = 'accepted'; return res.json({ message: 'Vous êtes maintenant connectés.', connection: 'connected' }); }
    return err(res, 409, 'Une demande existe déjà avec ce profil.');
  }
  connections.push({ id: seq.conn++, a: req.user.id, b: other.id, status: 'pending', created_at: new Date().toISOString() });
  res.status(201).json({ message: 'Demande de connexion envoyée.', connection: 'pending_out' });
});
app.patch('/api/connections/:id/accept', auth, (req, res) => {
  const c = connections.find(x => x.id === Number(req.params.id));
  if (!c) return err(res, 404, 'Demande introuvable.');
  if (c.b !== req.user.id || c.status !== 'pending') return err(res, 403, 'Action non autorisée.');
  c.status = 'accepted'; res.json({ message: 'Connexion acceptée.' });
});
app.delete('/api/connections/:id', auth, (req, res) => {
  const i = connections.findIndex(x => x.id === Number(req.params.id));
  if (i < 0) return err(res, 404, 'Connexion introuvable.');
  const c = connections[i];
  if (c.a !== req.user.id && c.b !== req.user.id) return err(res, 403, 'Action non autorisée.');
  connections.splice(i, 1); res.json({ message: 'Connexion supprimée.' });
});
// ---------- Universités et postes TA/RA ----------
const posOut = p => ({ ...p, university: universities.find(u => u.id === p.university_id), required_documents_labels: p.required_documents.map(k => ({ key: k, label: DOC_LABELS[k] })) });
app.get('/api/universities', (req, res) => {
  const { q, country } = req.query;
  let list = universities.slice();
  if (country) list = list.filter(u => u.country === country);
  if (q) list = list.filter(u => (u.name + u.city + u.country).toLowerCase().includes(q.toLowerCase()));
  res.json({ data: list.map(u => ({ ...u, positions_count: positions.filter(p => p.university_id === u.id).length })) });
});
app.get('/api/universities/:id', (req, res) => {
  const u = universities.find(x => x.id === Number(req.params.id));
  if (!u) return err(res, 404, 'Université introuvable.');
  res.json({ data: { ...u, positions: positions.filter(p => p.university_id === u.id).map(posOut) } });
});
app.get('/api/positions', (req, res) => {
  const { type, q, country, university_id } = req.query;
  let list = positions.map(posOut);
  if (type) list = list.filter(p => p.type === type);
  if (university_id) list = list.filter(p => String(p.university_id) === String(university_id));
  if (country) list = list.filter(p => p.university.country === country);
  if (q) list = list.filter(p => (p.title + p.field + p.department + p.university.name).toLowerCase().includes(q.toLowerCase()));
  res.json({ data: list });
});
app.get('/api/positions/:id', (req, res) => {
  const p = positions.find(x => x.id === Number(req.params.id));
  if (!p) return err(res, 404, 'Poste introuvable.');
  res.json({ data: posOut(p) });
});
app.post('/api/positions/:id/check', (req, res) => {
  const p = positions.find(x => x.id === Number(req.params.id));
  if (!p) return err(res, 404, 'Poste introuvable.');
  res.json(checkEligibility(p, req.body));
});
const DOCS = Object.keys(DOC_LABELS);
app.post('/api/positions/:id/applications', auth, role('student'), upload.fields(DOCS.map(d => ({ name: `documents[${d}]`, maxCount: 1 }))), (req, res) => {
  const p = positions.find(x => x.id === Number(req.params.id));
  if (!p) return err(res, 404, 'Poste introuvable.');
  if (applications.some(a => a.position_id === p.id && a.user_id === req.user.id)) return err(res, 409, 'Vous avez déjà postulé à ce poste.');
  const b = req.body, f = req.files || {};
  const provided = DOCS.filter(d => f[`documents[${d}]`] && f[`documents[${d}]`][0]);
  const bad = provided.filter(d => f[`documents[${d}]`][0].mimetype !== 'application/pdf');
  if (bad.length) return err(res, 422, 'Les documents doivent être au format PDF.', { documents: bad.map(d => `${DOC_LABELS[d]} : format PDF requis.`) });
  const input = { gpa: b.gpa, level: b.level, language_test: b.language_test || null, language_score: b.language_score, language_waiver: b.language_waiver === 'true' || b.language_waiver === '1', documents: provided };
  const result = checkEligibility(p, input);
  if (!result.eligible) return res.status(422).json({ message: 'Vous ne remplissez pas toutes les conditions d’admission de ce poste.', errors: { conditions: result.checks.filter(c => !c.ok).map(c => c.label) }, checks: result.checks });
  if (!b.motivation || b.motivation.trim().length < 50) return err(res, 422, 'Les données fournies sont invalides.', { motivation: ['Le message au comité est obligatoire (50 caractères minimum).'] });
  const a = { id: seq.app++, position_id: p.id, user_id: req.user.id, gpa: Number(b.gpa), level: b.level, language_test: input.language_test, language_score: b.language_score ? Number(b.language_score) : null, language_waiver: input.language_waiver, motivation: b.motivation.trim(), documents: provided, status: 'submitted', created_at: new Date().toISOString() };
  applications.push(a);
  res.status(201).json({ message: 'Candidature envoyée avec succès.', data: { id: a.id, status: a.status } });
});
app.get('/api/my/applications', auth, role('student'), (req, res) => res.json({ data: applications.filter(a => a.user_id === req.user.id).map(a => ({ id: a.id, status: a.status, created_at: a.created_at, position: posOut(positions.find(p => p.id === a.position_id)) })).reverse() }));

app.use((e, req, res, next) => err(res, e.code === 'LIMIT_FILE_SIZE' ? 422 : 500, e.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux (20 Mo maximum).' : 'Erreur serveur.'));
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`GradHive mock API sur http://localhost:${PORT}/api`));
