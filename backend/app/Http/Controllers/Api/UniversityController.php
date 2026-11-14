<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\University;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UniversityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = University::withCount('positions')->orderBy('name');
        if ($request->filled('country')) { $q->where('country', $request->query('country')); }
        if ($s = trim((string) $request->query('q'))) {
            $like = '%' . mb_strtolower($s) . '%';
            $q->where(fn ($w) => $w->whereRaw('LOWER(name) LIKE ?', [$like])->orWhereRaw('LOWER(city) LIKE ?', [$like])->orWhereRaw('LOWER(country) LIKE ?', [$like]));
        }
        return response()->json(['data' => $q->get()]);
    }

    public function show(int $id): JsonResponse
    {
        $u = University::with('positions.university')->find($id);
        if (!$u) { return response()->json(['message' => 'Université introuvable.'], 404); }
        return response()->json(['data' => array_merge($u->toArray(), [
            'positions' => $u->positions->map->present()->values(),
        ])]);
    }
}
