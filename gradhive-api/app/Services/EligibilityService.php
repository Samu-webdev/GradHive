<?php

namespace App\Services;

use DateTimeImmutable;
use DateTimeInterface;

/**
 * Vérifie les conditions d'admission d'un poste TA/RA.
 * Classe volontairement indépendante d'Eloquent : elle travaille sur des tableaux
 * et reste donc testable sans base de données.
 */
class EligibilityService
{
    public const LEVEL_RANK = ['licence' => 1, 'master' => 2, 'doctorat' => 3];
    public const LEVEL_LABEL = ['licence' => 'Licence', 'master' => 'Master', 'doctorat' => 'Doctorat'];
    public const DOC_LABELS = [
        'cv' => 'Curriculum vitae',
        'transcripts' => 'Relevés de notes',
        'motivation_letter' => 'Lettre de motivation',
        'recommendation_letter' => 'Lettre de recommandation',
        'research_proposal' => 'Projet de recherche',
        'language_certificate' => 'Certificat de langue',
        'passport' => 'Passeport',
    ];

    /**
     * @param array $position  Poste (level requis, moyenne, langues, documents, date limite)
     * @param array $input     gpa, level, language_test, language_score, language_waiver, documents[]
     * @return array{eligible: bool, checks: array<int, array<string, mixed>>}
     */
    public function check(array $position, array $input, ?DateTimeInterface $today = null): array
    {
        $checks = [];

        // 1. Niveau d'études
        $have = self::LEVEL_RANK[$input['level'] ?? ''] ?? 0;
        $need = self::LEVEL_RANK[$position['required_level']] ?? 0;
        $checks[] = [
            'key' => 'level',
            'label' => 'Niveau d’études minimum : ' . self::LEVEL_LABEL[$position['required_level']],
            'ok' => $have >= $need,
            'expected' => self::LEVEL_LABEL[$position['required_level']],
            'actual' => self::LEVEL_LABEL[$input['level'] ?? ''] ?? 'Non renseigné',
        ];

        // 2. Moyenne
        $gpaRaw = $input['gpa'] ?? null;
        $hasGpa = $gpaRaw !== null && $gpaRaw !== '' && is_numeric($gpaRaw);
        $min = (float) $position['min_average'];
        $checks[] = [
            'key' => 'gpa',
            'label' => 'Moyenne minimale : ' . $this->num($min) . '/20',
            'ok' => $hasGpa && (float) $gpaRaw >= $min,
            'expected' => $this->num($min) . '/20',
            'actual' => $hasGpa ? $this->num((float) $gpaRaw) . '/20' : 'Non renseignée',
        ];

        // 3. Langue
        $reqs = $position['language_requirements'] ?? [];
        if (!empty($reqs)) {
            $label = 'Test de langue : ' . implode(' ou ', array_map(
                fn ($t, $s) => "$t ≥ " . $this->num((float) $s), array_keys($reqs), $reqs
            ));
            $ok = false;
            $actual = 'Aucun test renseigné';
            $test = $input['language_test'] ?? null;
            $score = $input['language_score'] ?? null;
            if (!empty($position['language_waiver_allowed']) && !empty($input['language_waiver'])) {
                $ok = true;
                $actual = 'Dispense déclarée';
            } elseif ($test && $score !== null && $score !== '' && is_numeric($score)) {
                $actual = "$test " . $this->num((float) $score);
                $ok = isset($reqs[$test]) && (float) $score >= (float) $reqs[$test];
            }
            $checks[] = [
                'key' => 'language', 'label' => $label, 'ok' => $ok,
                'expected' => str_replace('Test de langue : ', '', $label), 'actual' => $actual,
            ];
        }

        // 4. Documents
        $provided = $input['documents'] ?? [];
        foreach ($position['required_documents'] as $doc) {
            $has = in_array($doc, $provided, true);
            $checks[] = [
                'key' => "doc_$doc",
                'label' => 'Document requis : ' . self::DOC_LABELS[$doc],
                'ok' => $has, 'expected' => 'Fourni', 'actual' => $has ? 'Fourni' : 'Manquant',
            ];
        }

        // 5. Date limite
        $today = $today ?? new DateTimeImmutable('today');
        $deadline = new DateTimeImmutable($position['deadline']);
        $checks[] = [
            'key' => 'deadline',
            'label' => 'Date limite : ' . $deadline->format('d/m/Y'),
            'ok' => $today->format('Y-m-d') <= $deadline->format('Y-m-d'),
            'expected' => $deadline->format('d/m/Y'), 'actual' => 'Aujourd’hui',
        ];

        return ['eligible' => !in_array(false, array_column($checks, 'ok'), true), 'checks' => $checks];
    }

    /** Affiche 13 au lieu de 13.0, mais garde 6.5. */
    private function num(float $n): string
    {
        return rtrim(rtrim(number_format($n, 2, '.', ''), '0'), '.');
    }
}
