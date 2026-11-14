<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicWork;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Projets et mémoires : l'étudiant les présente au réseau. Leur publication ne constitue pas une
 * validation académique. Les établissements disposent d'un profil distinct pour valoriser les parcours étudiants.
 */
class WorkController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = AcademicWork::with('author');

        if ($request->filled('author_id')) { $q->where('author_id', (int) $request->query('author_id')); }
        if ($s = trim((string) $request->query('q'))) {
            $like = '%' . str_replace(['%', '_'], ['\%', '\_'], mb_strtolower($s)) . '%';
            $q->where(function ($w) use ($like) {
                $w->whereRaw('LOWER(title) LIKE ?', [$like])
                  ->orWhereRaw('LOWER(abstract) LIKE ?', [$like])
                  ->orWhereRaw('LOWER(theme) LIKE ?', [$like])
                  ->orWhereRaw('LOWER(CAST(keywords AS TEXT)) LIKE ?', [$like])
                  ->orWhereHas('author', fn ($a) => $a->whereRaw('LOWER(name) LIKE ?', [$like]));
            });
        }
        if ($request->filled('year')) { $q->where('year', (int) $request->query('year')); }
        if ($request->filled('level')) { $q->where('level', $request->query('level')); }
        if ($request->filled('mention')) { $q->where('mention', $request->query('mention')); }

        $works = $q->latest()->get();
        return response()->json(['data' => $works->map->present()->values(), 'meta' => ['total' => $works->count()]]);
    }

    public function show(int $id): JsonResponse
    {
        $work = AcademicWork::with('author')->find($id);
        if (!$work) { return response()->json(['message' => 'Travail introuvable.'], 404); }
        $work->increment('views');
        return response()->json(['data' => $work->present()]);
    }

    public function mine(Request $request): JsonResponse
    {
        $this->authorizeRole($request, ['student']);
        $works = AcademicWork::with('author')->where('author_id', $request->user()->id)->latest()->get();
        return response()->json(['data' => $works->map->present(true)->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeRole($request, ['student']);
        $data = $request->validate([
            'title' => ['required', 'string', 'min:5', 'max:250'],
            'abstract' => ['required', 'string', 'min:30'],
            'theme' => ['required', 'string', 'max:100'],
            'level' => ['required', 'in:licence,master,doctorat'],
            'year' => ['required', 'integer', 'min:1990', 'max:' . (date('Y') + 1)],
            'mention' => ['nullable', 'in:passable,assez_bien,bien,tres_bien'],
            'supervisor' => ['nullable', 'string', 'max:120'],
            'keywords' => ['required', 'string'],
            'file' => ['required', 'file', 'mimes:pdf', 'max:20480'], // 20 Mo
        ], [
            'title.required' => 'Le titre est obligatoire (5 caractères minimum).', 'title.min' => 'Le titre est obligatoire (5 caractères minimum).',
            'abstract.required' => 'Le résumé est obligatoire (30 caractères minimum).', 'abstract.min' => 'Le résumé est obligatoire (30 caractères minimum).',
            'theme.required' => 'Le thème est obligatoire.', 'level.in' => 'Niveau invalide.', 'year.*' => 'Année invalide.',
            'keywords.required' => 'Au moins un mot-clé est obligatoire.',
            'file.required' => 'Le fichier PDF est obligatoire.', 'file.mimes' => 'Le fichier doit être au format PDF.',
            'file.max' => 'Fichier trop volumineux (20 Mo maximum).',
        ]);

        $keywords = array_values(array_filter(array_map('trim', explode(',', $data['keywords']))));
        if (!$keywords) {
            return response()->json(['message' => 'Les données fournies sont invalides.', 'errors' => ['keywords' => ['Au moins un mot-clé est obligatoire.']]], 422);
        }

        $file = $request->file('file');
        $work = AcademicWork::create([
            'author_id' => $request->user()->id,
            'title' => trim($data['title']), 'abstract' => trim($data['abstract']), 'theme' => $data['theme'],
            'level' => $data['level'], 'year' => $data['year'], 'mention' => $data['mention'] ?? null,
            'supervisor' => $data['supervisor'] ?? null, 'keywords' => $keywords,
            'institution' => $request->user()->institution,
            'file_path' => $file->store('works', config('gradhive.files_disk')), 'file_name' => $file->getClientOriginalName(),
        ]);
        $work->load('author');

        return response()->json(['message' => 'Votre projet est en ligne : le réseau peut le découvrir !', 'data' => $work->present(true)], 201);
    }

    /** Téléchargement réservé aux utilisateurs authentifiés. */
    public function download(Request $request, int $id): StreamedResponse|JsonResponse
    {
        $work = AcademicWork::find($id);
        if (!$work) { return response()->json(['message' => 'Travail introuvable.'], 404); }
        $disk = config('gradhive.files_disk');
        if (!$work->file_path || !Storage::disk($disk)->exists($work->file_path)) {
            return response()->json(['message' => 'Fichier non disponible.'], 404);
        }
        return Storage::disk($disk)->download($work->file_path, $work->file_name ?? 'memoire.pdf', ['Content-Type' => 'application/pdf']);
    }
}
