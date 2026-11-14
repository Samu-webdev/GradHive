<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Position;
use App\Services\EligibilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApplicationController extends Controller
{
    /** Dépôt d'une candidature TA/RA : les conditions d'admission sont revérifiées côté serveur. */
    public function store(Request $request, int $id, EligibilityService $service): JsonResponse
    {
        $this->authorizeRole($request, ['student']);
        $position = Position::with('university')->find($id);
        if (!$position) { return response()->json(['message' => 'Poste introuvable.'], 404); }

        $user = $request->user();
        if (Application::where('position_id', $position->id)->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'Vous avez déjà postulé à ce poste.'], 409); // RG11
        }

        $request->validate(['documents.*' => ['file', 'mimes:pdf', 'max:5120']], [
            'documents.*.mimes' => 'Les documents doivent être au format PDF.',
            'documents.*.max' => 'Un document dépasse 5 Mo.',
        ]);

        $allowed = array_keys(EligibilityService::DOC_LABELS);
        $files = array_filter((array) $request->file('documents', []), fn ($f, $k) => in_array($k, $allowed, true) && $f, ARRAY_FILTER_USE_BOTH);

        $result = $service->check($position->toRules(), [
            'gpa' => $request->input('gpa'), 'level' => $request->input('level'),
            'language_test' => $request->input('language_test'), 'language_score' => $request->input('language_score'),
            'language_waiver' => $request->boolean('language_waiver'), 'documents' => array_keys($files),
        ]);
        if (!$result['eligible']) {
            return response()->json([
                'message' => 'Vous ne remplissez pas toutes les conditions d’admission de ce poste.',
                'errors' => ['conditions' => array_values(array_map(fn ($c) => $c['label'], array_filter($result['checks'], fn ($c) => !$c['ok'])))],
                'checks' => $result['checks'],
            ], 422);
        }

        $motivation = trim((string) $request->input('motivation'));
        if (mb_strlen($motivation) < 50) {
            return response()->json([
                'message' => 'Les données fournies sont invalides.',
                'errors' => ['motivation' => ['Le message au comité est obligatoire (50 caractères minimum).']],
            ], 422);
        }

        $stored = [];
        foreach ($files as $key => $file) {
            $stored[$key] = $file->store("applications/{$user->id}/{$position->id}", config('gradhive.files_disk'));
        }

        $application = Application::create([
            'position_id' => $position->id, 'user_id' => $user->id,
            'gpa' => (float) $request->input('gpa'), 'level' => $request->input('level'),
            'language_test' => $request->input('language_test') ?: null,
            'language_score' => $request->filled('language_score') ? (float) $request->input('language_score') : null,
            'language_waiver' => $request->boolean('language_waiver'),
            'motivation' => $motivation, 'documents' => $stored, 'status' => 'submitted',
        ]);

        return response()->json([
            'message' => 'Candidature envoyée avec succès.',
            'data' => ['id' => $application->id, 'status' => $application->status],
        ], 201);
    }

    public function mine(Request $request): JsonResponse
    {
        $this->authorizeRole($request, ['student']);
        $items = Application::with('position.university')->where('user_id', $request->user()->id)->latest()->get();
        return response()->json(['data' => $items->map(fn ($a) => [
            'id' => $a->id, 'status' => $a->status, 'created_at' => $a->created_at->toIso8601String(),
            'position' => $a->position->present(),
        ])->values()]);
    }
}
