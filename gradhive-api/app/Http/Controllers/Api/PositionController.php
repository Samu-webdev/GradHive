<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Position;
use App\Services\EligibilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PositionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Position::with('university')->orderBy('deadline');
        if ($request->filled('type')) { $q->where('type', $request->query('type')); }
        if ($request->filled('university_id')) { $q->where('university_id', (int) $request->query('university_id')); }
        if ($request->filled('country')) { $q->whereHas('university', fn ($u) => $u->where('country', $request->query('country'))); }
        if ($s = trim((string) $request->query('q'))) {
            $like = '%' . mb_strtolower($s) . '%';
            $q->where(function ($w) use ($like) {
                $w->whereRaw('LOWER(title) LIKE ?', [$like])->orWhereRaw('LOWER(field) LIKE ?', [$like])
                  ->orWhereRaw('LOWER(department) LIKE ?', [$like])
                  ->orWhereHas('university', fn ($u) => $u->whereRaw('LOWER(name) LIKE ?', [$like]));
            });
        }
        return response()->json(['data' => $q->get()->map->present()->values()]);
    }

    public function show(int $id): JsonResponse
    {
        $p = Position::with('university')->find($id);
        if (!$p) { return response()->json(['message' => 'Poste introuvable.'], 404); }
        return response()->json(['data' => $p->present()]);
    }

    /** Contrôle d'éligibilité en temps réel (public) : source unique de vérité pour web et mobile. */
    public function check(Request $request, int $id, EligibilityService $service): JsonResponse
    {
        $p = Position::find($id);
        if (!$p) { return response()->json(['message' => 'Poste introuvable.'], 404); }
        return response()->json($service->check($p->toRules(), [
            'gpa' => $request->input('gpa'), 'level' => $request->input('level'),
            'language_test' => $request->input('language_test'), 'language_score' => $request->input('language_score'),
            'language_waiver' => $request->boolean('language_waiver'),
            'documents' => (array) $request->input('documents', []),
        ]));
    }
}
