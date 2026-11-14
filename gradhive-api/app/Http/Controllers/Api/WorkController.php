<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicWork;
use App\Services\PdfStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/**
 * Academic work is user-published content, not an institutional academic certification.
 */
class WorkController extends Controller
{
    private const TYPES = ['project', 'thesis', 'dissertation', 'publication', 'portfolio'];

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'author_id' => ['sometimes', 'integer', 'min:1'],
            'q' => ['sometimes', 'string', 'max:200'],
            'year' => ['sometimes', 'integer', 'min:1990', 'max:2100'],
            'level' => ['sometimes', 'in:licence,master,doctorat'],
            'mention' => ['sometimes', 'in:passable,assez_bien,bien,tres_bien'],
            'type' => ['sometimes', Rule::in(self::TYPES)],
            'visibility' => ['sometimes', 'in:public,private'],
            'institution' => ['sometimes', 'string', 'max:150'],
            'field_of_study' => ['sometimes', 'string', 'max:120'],
        ]);

        $q = AcademicWork::with('author')->where(function ($visible) use ($request) {
            $visible->where('visibility', 'public');
            if ($request->user()) {
                $visible->orWhere('author_id', $request->user()->id);
            }
        });

        if (isset($filters['author_id'])) {
            $q->where('author_id', $filters['author_id']);
        }
        if (! empty($filters['q'])) {
            $like = '%'.str_replace(['%', '_'], ['\%', '\_'], mb_strtolower(trim($filters['q']))).'%';
            $q->where(function ($w) use ($like) {
                $w->whereRaw('LOWER(title) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(abstract) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(theme) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(CAST(keywords AS TEXT)) LIKE ?', [$like])
                    ->orWhereHas('author', fn ($a) => $a->whereRaw('LOWER(name) LIKE ?', [$like]));
            });
        }
        foreach (['year', 'level', 'mention', 'type', 'visibility'] as $field) {
            if (isset($filters[$field])) {
                $q->where($field, $filters[$field]);
            }
        }
        if (! empty($filters['institution'])) {
            $institution = '%'.str_replace(['%', '_'], ['\%', '\_'], mb_strtolower(trim($filters['institution']))).'%';
            $q->whereRaw('LOWER(institution) LIKE ?', [$institution]);
        }
        if (! empty($filters['field_of_study'])) {
            $field = '%'.str_replace(['%', '_'], ['\%', '\_'], mb_strtolower(trim($filters['field_of_study']))).'%';
            $q->whereHas('author', fn ($author) => $author->whereRaw('LOWER(field_of_study) LIKE ?', [$field]));
        }

        $works = $q->latest()->get();

        return response()->json(['data' => $works->map->present()->values(), 'meta' => ['total' => $works->count()]]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $work = AcademicWork::with('author')->find($id);
        if (! $work) {
            return response()->json(['message' => 'Travail introuvable.'], 404);
        }
        if ($work->visibility !== 'public' && (! $request->user() || ! $request->user()->can('view', $work))) {
            return response()->json(['message' => 'Travail introuvable.'], 404);
        }

        $work->increment('views');

        return response()->json(['data' => $work->present()]);
    }

    public function mine(Request $request): JsonResponse
    {
        $this->authorizeRole($request, ['student']);
        $works = AcademicWork::with('author')->where('author_id', $request->user()->id)->latest()->get();

        return response()->json(['data' => $works->map->present(true)->values()]);
    }

    public function store(Request $request, PdfStorage $pdfStorage): JsonResponse
    {
        $this->authorizeRole($request, ['student']);
        $data = $this->validatedWork($request, true);
        $keywords = $this->keywords($data['keywords']);
        $file = $request->file('file');
        $path = null;

        try {
            $path = $pdfStorage->store($file, 'works');
            $work = DB::transaction(fn () => AcademicWork::create([
                'author_id' => $request->user()->id,
                'title' => trim($data['title']), 'abstract' => trim($data['abstract']), 'theme' => trim($data['theme']),
                'level' => $data['level'], 'year' => $data['year'], 'mention' => $data['mention'] ?? null,
                'supervisor' => isset($data['supervisor']) ? trim($data['supervisor']) : null,
                'keywords' => $keywords, 'type' => $data['type'] ?? 'project',
                'visibility' => $data['visibility'] ?? 'public',
                'institution' => $request->user()->institution,
                'file_path' => $path,
                'file_name' => $this->safeOriginalName($file->getClientOriginalName()),
            ]));
        } catch (Throwable $exception) {
            $pdfStorage->delete($path);
            throw $exception;
        }

        $work->load('author');

        return response()->json([
            'message' => 'Votre projet est en ligne : le réseau peut le découvrir !',
            'data' => $work->present(true),
        ], 201);
    }

    public function update(Request $request, int $id, PdfStorage $pdfStorage): JsonResponse
    {
        $work = AcademicWork::find($id);
        if (! $work) {
            return response()->json(['message' => 'Travail introuvable.'], 404);
        }
        $this->authorize('update', $work);

        $data = $this->validatedWork($request, false);
        $keywords = array_key_exists('keywords', $data) ? $this->keywords($data['keywords']) : null;
        $file = $request->file('file');
        $newPath = null;
        $oldPath = $work->file_path;

        try {
            if ($file) {
                $newPath = $pdfStorage->store($file, 'works');
            }
            DB::transaction(function () use ($work, $data, $keywords, $file, $newPath): void {
                foreach (['title', 'abstract', 'theme', 'level', 'year', 'mention', 'supervisor', 'type', 'visibility'] as $field) {
                    if (array_key_exists($field, $data)) {
                        $work->{$field} = is_string($data[$field]) ? trim($data[$field]) : $data[$field];
                    }
                }
                if ($keywords !== null) {
                    $work->keywords = $keywords;
                }
                if ($file && $newPath) {
                    $work->file_path = $newPath;
                    $work->file_name = $this->safeOriginalName($file->getClientOriginalName());
                }
                $work->save();
            });
        } catch (Throwable $exception) {
            $pdfStorage->delete($newPath);
            throw $exception;
        }

        if ($newPath && $oldPath) {
            $pdfStorage->delete($oldPath);
        }
        $work->load('author');

        return response()->json(['message' => 'Travail mis à jour.', 'data' => $work->present(true)]);
    }

    public function destroy(int $id, PdfStorage $pdfStorage): JsonResponse
    {
        $work = AcademicWork::find($id);
        if (! $work) {
            return response()->json(['message' => 'Travail introuvable.'], 404);
        }
        $this->authorize('delete', $work);
        $path = $work->file_path;
        DB::transaction(fn () => $work->delete());
        $pdfStorage->delete($path);

        return response()->json(['message' => 'Travail supprimé.']);
    }

    /** Public files are downloadable by anyone; private files are limited to their student owner. */
    public function download(Request $request, int $id): StreamedResponse|JsonResponse
    {
        $work = AcademicWork::find($id);
        if (! $work) {
            return response()->json(['message' => 'Travail introuvable.'], 404);
        }
        if ($work->visibility !== 'public' && (! $request->user() || ! $request->user()->can('view', $work))) {
            return response()->json(['message' => 'Travail introuvable.'], 404);
        }

        $disk = config('gradhive.files_disk');
        if (! $work->file_path || ! Storage::disk($disk)->exists($work->file_path)) {
            return response()->json(['message' => 'Fichier non disponible.'], 404);
        }

        return Storage::disk($disk)->download($work->file_path, 'work-'.$work->id.'.pdf', ['Content-Type' => 'application/pdf']);
    }

    private function validatedWork(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'title' => [$required, 'string', 'min:5', 'max:250'],
            'abstract' => [$required, 'string', 'min:30', 'max:20000'],
            'theme' => [$required, 'string', 'max:100'],
            'level' => [$required, 'in:licence,master,doctorat'],
            'year' => [$required, 'integer', 'min:1990', 'max:'.(date('Y') + 1)],
            'mention' => ['sometimes', 'nullable', 'in:passable,assez_bien,bien,tres_bien'],
            'supervisor' => ['sometimes', 'nullable', 'string', 'max:120'],
            'keywords' => [$required, 'string', 'max:1000'],
            'type' => ['sometimes', Rule::in(self::TYPES)],
            'visibility' => ['sometimes', 'in:public,private'],
            'file' => [$creating ? 'required' : 'sometimes', 'file', 'mimes:pdf', 'mimetypes:application/pdf', 'max:20480'],
        ], [
            'title.min' => 'Le titre est obligatoire (5 caractères minimum).',
            'abstract.min' => 'Le résumé est obligatoire (30 caractères minimum).',
            'level.in' => 'Niveau invalide.', 'year.*' => 'Année invalide.',
            'keywords.required' => 'Au moins un mot-clé est obligatoire.',
            'type.*' => 'Type de travail invalide.', 'visibility.*' => 'Visibilité invalide.',
            'file.required' => 'Le fichier PDF est obligatoire.',
            'file.mimes' => 'Le fichier doit être au format PDF.',
            'file.mimetypes' => 'Le fichier doit être au format PDF.',
            'file.max' => 'Fichier trop volumineux (20 Mo maximum).',
        ]);
    }

    private function keywords(string $input): array
    {
        $keywords = array_values(array_unique(array_filter(array_map('trim', explode(',', $input)))));
        if (! $keywords) {
            throw ValidationException::withMessages(['keywords' => ['Au moins un mot-clé est obligatoire.']]);
        }

        return $keywords;
    }

    private function safeOriginalName(string $name): string
    {
        $name = basename(str_replace('\\', '/', $name));
        $name = Str::limit(trim($name), 255, '');

        return $name !== '' ? $name : 'document.pdf';
    }
}
