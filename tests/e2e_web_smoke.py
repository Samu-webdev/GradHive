"""Test de fumée de bout en bout (Playwright + Chromium).

Pré-requis (3 terminaux) :
  1) cd gradhive-api && php artisan serve         -> API sur http://localhost:8000/api
  2) npm start                                    -> web sur http://localhost:4200
  3) pip install -r tests/requirements.txt && playwright install chromium
     python tests/e2e_web_smoke.py

Variables facultatives : GRADHIVE_URL (défaut http://localhost:4200).
Le test crée un compte à adresse unique : il peut être relancé sans redémarrer l'API.
"""
import os, tempfile, time
from playwright.sync_api import sync_playwright

BASE = os.environ.get('GRADHIVE_URL', 'http://localhost:4200').rstrip('/')
PDF = os.path.join(tempfile.gettempdir(), 'gradhive-test.pdf')
open(PDF, 'wb').write(b'%PDF-1.1\ntrailer<<>>\n%%EOF')
EMAIL = f'test{int(time.time())}@gradhive.test'
STUDENT = f'Test Étudiant {int(time.time())}'
res = []

def ok(name, cond, extra=''):
    res.append(bool(cond)); print('PASS' if cond else 'FAIL', name, extra)

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.evaluate("localStorage.setItem('gradhive-language', 'fr')"); pg.reload()
    pg.wait_for_function("() => { const n = document.querySelector('.stats li:first-child b'); return n && Number(n.textContent.trim()) >= 13; }")
    ok('accueil : compteur de membres affiché', int(pg.inner_text('.stats li:first-child b').strip() or 0) >= 13)
    ok('menu : liens essentiels', 'Postes TA/RA' in pg.inner_text('header') and 'Projets' in pg.inner_text('header'))

    pg.goto(BASE + '/inscription'); pg.get_by_role('button', name='Continuer').click()
    pg.fill('#name', STUDENT); pg.fill('#email', EMAIL); pg.fill('#country', 'Sénégal')
    pg.fill('#institution', "SUP'INFO Dakar"); pg.fill('#field', 'Informatique'); pg.fill('#password', 'Secret123!'); pg.fill('#pc', 'Secret123!')
    pg.click('button[type=submit]'); pg.wait_for_selector('.me'); ok('inscription : connecté', True)

    pg.goto(BASE + '/mon-profil'); pg.wait_for_selector('#visibility')
    pg.select_option('#visibility', 'public'); pg.get_by_role('button', name='Enregistrer le profil').click()
    student_id = pg.evaluate("""async () => {
      const token = localStorage.getItem('gradhive_token');
      const response = await fetch('http://localhost:8000/api/me', {headers: {Authorization: `Bearer ${token}`}});
      return (await response.json()).user.id;
    }""")
    pg.goto(f'{BASE}/etudiants/{student_id}'); pg.wait_for_selector('.profile')
    ok('profil étudiant : visibilité publique activée', STUDENT in pg.inner_text('.profile'))

    pg.goto(BASE + '/memoires/publier'); pg.wait_for_selector('#title'); pg.fill('#title', 'Projet de test pour le jury')
    pg.fill('#abstract', 'Un résumé suffisamment long pour passer la validation du formulaire.'); pg.select_option('#theme', 'Génie logiciel')
    pg.fill('#kw', 'test'); pg.set_input_files('input[type=file]', PDF); pg.click('button[type=submit]'); pg.wait_for_url('**/mes-memoires')
    pg.goto(BASE + '/memoires'); pg.wait_for_selector('.work'); ok('projet publié et visible sans validation', 'Projet de test pour le jury' in pg.inner_text('body'))
    details_href = pg.locator('article.work a[href^="/memoires/"]').first.get_attribute('href')
    pg.goto(BASE + details_href); pg.wait_for_selector('.detail')
    ok('détail public du travail', 'Projet de test pour le jury' in pg.inner_text('.detail'))

    pg.goto(BASE + '/mes-memoires')
    card = pg.locator('article').filter(has_text='Projet de test pour le jury')
    card.get_by_role('button', name='Modifier').click()
    card.locator('select[formControlName="visibility"]').select_option('private')
    card.locator('select[formControlName="type"]').select_option('thesis')
    card.get_by_role('button', name='Enregistrer les modifications').click()
    card.locator('.badge').filter(has_text='Privé').wait_for()
    anonymous = b.new_page(viewport={'width': 1280, 'height': 900})
    anonymous.goto(BASE + details_href); anonymous.get_by_role('heading', name='Travail indisponible').wait_for()
    ok('travail privé inaccessible au public', True)
    anonymous.close()

    school = b.new_page(viewport={'width': 1280, 'height': 900})
    school.goto(BASE + '/connexion'); school.fill('#email', 'school@gradhive.test'); school.fill('#password', 'password')
    school.click('button[type=submit]'); school.wait_for_selector('.me')
    school.goto(BASE + '/mon-profil'); school.wait_for_selector('input[name="candidateSearch"]')
    school.fill('input[name="candidateSearch"]', STUDENT); school.get_by_role('button', name='Rechercher').click()
    school.wait_for_selector('#candidate', timeout=10000)
    school.locator('#candidate').select_option(label=f'{STUDENT} · Informatique')
    school.get_by_role('button', name='Ajouter à la sélection').click()
    school.get_by_text(STUDENT, exact=True).wait_for()
    school_id = school.evaluate("""async () => {
      const token = localStorage.getItem('gradhive_token');
      const response = await fetch('http://localhost:8000/api/me', {headers: {Authorization: `Bearer ${token}`}});
      return (await response.json()).user.id;
    }""")
    school.goto(f'{BASE}/etablissements/{school_id}'); school.wait_for_selector('.highlight')
    school.get_by_text(STUDENT, exact=True).wait_for()
    ok('école : mise en avant promotionnelle publiée', True)
    school.goto(BASE + '/annuaire'); school.fill('input[formControlName="q"]', STUDENT)
    student_card = school.locator('article.member').filter(has_text=STUDENT)
    student_card.wait_for(state='visible')
    school.wait_for_timeout(350)
    student_card.first.get_by_role('button', name='Envoyer une demande').click()
    student_card.first.get_by_text('Demande envoyée', exact=True).wait_for(timeout=10000)
    pg.goto(BASE + '/connexions'); pg.get_by_role('button', name='Accepter').wait_for()
    pg.get_by_role('button', name='Accepter').click(); pg.get_by_text('Relations établies').wait_for()
    ok('annuaire et connexions : demande acceptée', True)
    school.close()

    pg.goto(BASE + '/postes/1'); pg.wait_for_selector('.checks li'); pg.fill('#gpa', '15'); pg.select_option('#lt', 'TCF'); pg.fill('#ls', '550')
    for i in range(5): pg.locator('input[type=file]').nth(i).set_input_files(PDF)
    pg.fill('#m', "Je souhaite rejoindre votre laboratoire pour contribuer à des recherches appliquées à l'éducation numérique."); pg.wait_for_timeout(900)
    ok('TA/RA : éligibilité détectée', 'toutes les conditions' in pg.inner_text('.verdict'))
    pg.click('button.btn.block'); pg.wait_for_url('**/mes-candidatures'); ok('TA/RA : candidature envoyée', True)

    pg.goto(BASE + '/page-inexistante'); pg.wait_for_selector('.code'); ok('404 : page dynamique', 'introuvable' in pg.inner_text('h1').lower())
    pg.goto(BASE + '/erreur/403'); pg.wait_for_selector('h1'); ok('403 : page dédiée', 'refusé' in pg.inner_text('h1').lower())
    ok('aucune erreur JavaScript', not errs, str(errs[:2])); b.close()

print(sum(res), '/', len(res)); raise SystemExit(0 if all(res) else 1)
