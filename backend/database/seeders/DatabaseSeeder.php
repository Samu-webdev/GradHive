<?php

namespace Database\Seeders;

use App\Models\AcademicWork;
use App\Models\Opportunity;
use App\Models\Position;
use App\Models\University;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Données de démonstration. Les profils (hors comptes « SUP'INFO »), les universités et leurs conditions
     * d'admission TA/RA sont FICTIFS : remplacez-les par des données réelles avant toute mise en production.
     */
    private ?string $demoPassword = null;

    public function run(): void
    {
        // En production, les comptes de démonstration ne sont créés que si DEMO_PASSWORD est défini :
        // jamais de mot de passe connu publiquement (« password ») sur un serveur exposé.
        $this->demoPassword = config('gradhive.demo_password');
        if (! $this->demoPassword) {
            $this->command?->warn('Données de démonstration ignorées : définissez DEMO_PASSWORD pour les créer en production.');

            return;
        }

        // Comptes de démonstration (mot de passe : "password")
        User::updateOrCreate(['email' => 'admin@gradhive.test'], [
            'name' => 'Administrateur GradHive', 'password' => $this->demoPassword, 'role' => 'admin', 'status' => 'active', 'country' => 'Sénégal',
        ]);
        User::updateOrCreate(['email' => 'school@gradhive.test'], [
            'name' => "SUP'INFO Dakar", 'password' => $this->demoPassword, 'role' => 'school', 'status' => 'active', 'country' => 'Sénégal',
            'institution' => "SUP'INFO Dakar", 'headline' => 'Établissement d’enseignement supérieur · Dakar',
            'bio' => 'Formation en informatique et systèmes d’information, de la licence au master.', 'website' => 'https://example.org/supinfo',
        ]);
        $student = User::updateOrCreate(['email' => 'student@gradhive.test'], [
            'name' => 'Jorres', 'password' => $this->demoPassword, 'role' => 'student', 'status' => 'active', 'country' => 'Sénégal',
            'institution' => "SUP'INFO Dakar", 'field_of_study' => 'Informatique', 'level' => 'master',
            'headline' => 'Master en génie logiciel · Passionnée d’IA appliquée à l’éducation',
            'bio' => 'Je conçois des plateformes qui rapprochent les étudiants africains des opportunités internationales.',
        ]);

        // Profils fictifs pour animer le réseau : [nom, rôle, pays, établissement, filière, niveau, accroche]
        $demo = [
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
        ];
        $authors = [];
        foreach ($demo as $i => [$name, $role, $country, $institution, $field, $level, $headline]) {
            $authors[$name] = User::updateOrCreate(['email' => "demo$i@gradhive.test"], [
                'name' => $name, 'password' => $this->demoPassword, 'role' => $role, 'status' => 'active', 'country' => $country,
                'institution' => $institution, 'field_of_study' => $field, 'level' => $level, 'headline' => $headline,
            ]);
        }
        $authors['Jorres'] = $student;

        // Universités et postes TA/RA (conditions d'admission)
        $dir = __DIR__ . '/data';
        foreach (json_decode(file_get_contents("$dir/universities.json"), true) as $u) {
            University::updateOrCreate(['id' => $u['id']], collect($u)->except('id')->all());
        }
        foreach (json_decode(file_get_contents("$dir/positions.json"), true) as $p) {
            if (empty($p['language_requirements'])) { $p['language_requirements'] = []; }
            Position::updateOrCreate(['id' => $p['id']], collect($p)->except('id')->all());
        }
        $this->resetSequences();

        // Quelques projets présentés (sans fichier PDF : données de démonstration)
        if (AcademicWork::count() === 0) {
            $works = [
                ['Jorres', 'Conception d’une plateforme de mentorat pour étudiants africains', 'Étude et réalisation d’une application web et mobile reliant étudiants et mentors de la diaspora.', 'Génie logiciel', 'master', 2025, 'tres_bien', ['mentorat', 'Laravel', 'Angular']],
                ['Moussa Fall', 'Système de gestion intelligente des stocks pour PME sénégalaises', 'Conception d’un outil de prévision des ruptures de stock à partir de données de ventes.', 'Systèmes d’information', 'licence', 2024, 'bien', ['stocks', 'prévision', 'PME']],
                ['Awa Sarr', 'Application mobile de suivi de la santé maternelle en zone rurale', 'Application Flutter fonctionnant hors ligne pour le suivi des consultations prénatales.', 'Santé numérique', 'master', 2025, 'bien', ['Flutter', 'santé', 'hors ligne']],
            ];
            foreach ($works as [$author, $title, $abstract, $theme, $level, $year, $mention, $keywords]) {
                AcademicWork::create([
                    'author_id' => $authors[$author]->id, 'title' => $title, 'abstract' => $abstract, 'theme' => $theme, 'level' => $level,
                    'year' => $year, 'mention' => $mention, 'supervisor' => 'Dr Ndiaye', 'keywords' => $keywords,
                    'institution' => $authors[$author]->institution,
                ]);
            }
        }

        $opportunities = [
            [
                'owner' => 'Sahel Digital', 'type' => 'employment',
                'title' => 'Démo GradHive — Ingénieur logiciel junior',
                'organization_name' => 'Sahel Digital', 'location' => 'Dakar · Hybride', 'country' => 'Sénégal',
                'employment_type' => 'full-time', 'deadline' => now()->addMonths(3)->toDateString(),
                'description' => 'Annonce fictive de démonstration. Remplacez-la par une offre réelle avant toute diffusion.',
            ],
            [
                'owner' => 'Sahel Digital', 'type' => 'internship',
                'title' => 'Démo GradHive — Stage en cybersécurité',
                'organization_name' => 'Sahel Digital', 'location' => 'Dakar', 'country' => 'Sénégal',
                'employment_type' => 'internship', 'deadline' => now()->addMonths(2)->toDateString(),
                'description' => 'Annonce fictive de démonstration pour illustrer les offres de stage. Remplacez-la par une offre réelle.',
            ],
            [
                'owner' => 'Fondation Horizon Afrique', 'type' => 'scholarship',
                'title' => 'Démo GradHive — Bourse internationale de master',
                'organization_name' => 'Fondation Horizon Afrique', 'location' => 'International', 'country' => 'International',
                'funding' => 'Montant fictif à confirmer', 'deadline' => now()->addMonths(4)->toDateString(),
                'description' => 'Annonce fictive de démonstration. Les conditions et financements doivent être confirmés par l’organisme.',
            ],
            [
                'owner' => 'Université Baobab', 'type' => 'mobility_program',
                'title' => 'Démo GradHive — Mobilité internationale de master',
                'organization_name' => 'Université Baobab', 'location' => 'Abidjan · International', 'country' => 'Côte d’Ivoire',
                'deadline' => now()->addMonths(5)->toDateString(),
                'description' => 'Programme fictif de démonstration. Remplacez-le par un programme de mobilité vérifié.',
            ],
            [
                'owner' => 'Baobab Labs', 'type' => 'research_program',
                'title' => 'Démo GradHive — Recherche en santé numérique',
                'organization_name' => 'Baobab Labs', 'location' => 'Bamako · Hybride', 'country' => 'Mali',
                'deadline' => now()->addMonths(3)->toDateString(),
                'description' => 'Programme fictif de démonstration. Remplacez-le par un appel à projets de recherche vérifié.',
            ],
        ];

        foreach ($opportunities as $opportunity) {
            $owner = $authors[$opportunity['owner']];
            unset($opportunity['owner']);
            Opportunity::updateOrCreate(
                ['title' => $opportunity['title']],
                [...$opportunity, 'owner_id' => $owner->id, 'status' => 'open'],
            );
        }
    }

    /** PostgreSQL : réaligne les séquences après insertion d'identifiants explicites. */
    private function resetSequences(): void
    {
        if (config('database.default') !== 'pgsql') { return; }
        foreach (['universities', 'positions'] as $table) {
            \DB::statement("SELECT setval(pg_get_serial_sequence('$table', 'id'), COALESCE((SELECT MAX(id) FROM $table), 1))");
        }
    }
}
