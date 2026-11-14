<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Position;
use App\Services\EligibilityService;
use App\Services\PdfStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

class ApplicationController extends Controller
{
    /** Dépôt d'une candidature TA/RA : les conditions d'admission sont revérifiées côté serveur. */
    public function store(Request $request, int $id, EligibilityService $service, PdfStorage $pdfStorage): JsonResponse
    {
        $this->authorizeRole($request, ['student']);
        $position = Position::with('university')->find($id);
        if (! $position) {
            return response()->json(['message' => 'Poste introuvable.'], 404);
        }

        $user = $request->user();
        if (Application::where('position_id', $position->id)->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'Vous avez déjà postulé à ce poste.'], 409); // RG11
        }

        $data = $request->validate([
            'gpa' => ['required', 'numeric', 'min:0', 'max:20'],
            'level' => ['required', 'in:licence,master,doctorat'],
            'language_test' => ['nullable', 'string', 'max:10'],
            'language_score' => ['nullable', 'numeric', 'min:0', 'max:1200'],
            'language_waiver' => ['sometimes', 'boolean'],
            'motivation' => ['required', 'string', 'min:50', 'max:5000'],
            'documents' => ['nullable', 'array', 'max:7'],
            'documents.*' => ['file', 'mimes:pdf', 'mimetypes:application/pdf', 'max:5120'],
        ], [
            'gpa.*' => 'La moyenne doit être comprise entre 0 et 20.',
            'level.*' => 'Niveau invalide.',
            'language_score.*' => 'Score de langue invalide.',
            'language_waiver.boolean' => 'La demande de dispense est invalide.',
            'motivation.*' => 'Le message au comité est obligatoire (50 caractères minimum, 5 000 maximum).',
            'documents.*.mimes' => 'Les documents doivent être au format PDF.',
            'documents.*.mimetypes' => 'Les documents doivent être au format PDF.',
            'documents.*.max' => 'Un document dépasse 5 Mo.',
        ]);

        $allowed = array_keys(EligibilityService::DOC_LABELS);
        $files = (array) $request->file('documents', []);
        $unknownDocuments = array_diff(array_keys($files), $allowed);
        if ($unknownDocuments) {
            throw ValidationException::withMessages(['documents' => ['Type de document invalide.']]);
        }

        $result = $service->check($position->toRules(), [
            'gpa' => $data['gpa'], 'level' => $data['level'],
            'language_test' => $data['language_test'] ?? null, 'language_score' => $data['language_score'] ?? null,
            'language_waiver' => $request->boolean('language_waiver'), 'documents' => array_keys($files),
        ]);
        if (! $result['eligible']) {
            return response()->json([
                'message' => 'Vous ne remplissez pas toutes les conditions d’admission de ce poste.',
                'errors' => ['conditions' => array_values(array_map(fn ($c) => $c['label'], array_filter($result['checks'], fn ($c) => ! $c['ok'])))],
                'checks' => $result['checks'],
            ], 422);
        }

        $stored = [];
        try {
            foreach ($files as $key => $file) {
                $stored[$key] = $pdfStorage->store($file, "applications/{$user->id}/{$position->id}");
            }

            $application = DB::transaction(fn () => Application::create([
                'position_id' => $position->id, 'user_id' => $user->id,
                'gpa' => (float) $data['gpa'], 'level' => $data['level'],
                'language_test' => $data['language_test'] ?? null,
                'language_score' => isset($data['language_score']) ? (float) $data['language_score'] : null,
                'language_waiver' => $request->boolean('language_waiver'),
                'motivation' => trim($data['motivation']), 'documents' => $stored, 'status' => 'submitted',
            ]));
        } catch (Throwable $exception) {
            Storage::disk(config('gradhive.files_disk'))->delete(array_values($stored));
            throw $exception;
        }

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
