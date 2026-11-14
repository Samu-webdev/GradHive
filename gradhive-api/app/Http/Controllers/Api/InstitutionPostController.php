<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InstitutionPost;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InstitutionPostController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $posts = InstitutionPost::with('institution')->where('institution_user_id', $request->user()->id)
            ->latest()->get();

        return response()->json(['data' => $posts->map->present()->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:200'],
            'body' => ['required', 'string', 'min:20', 'max:5000'],
        ]);
        $post = InstitutionPost::create($data + ['institution_user_id' => $request->user()->id]);
        $post->load('institution');

        return response()->json(['data' => $post->present()], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $post = InstitutionPost::where('institution_user_id', $request->user()->id)->find($id);
        if (! $post) {
            return response()->json(['message' => 'Institutional post not found.'], 404);
        }
        $post->fill($request->validate([
            'title' => ['sometimes', 'string', 'min:3', 'max:200'],
            'body' => ['sometimes', 'string', 'min:20', 'max:5000'],
        ]))->save();
        $post->load('institution');

        return response()->json(['data' => $post->present()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $post = InstitutionPost::where('institution_user_id', $request->user()->id)->find($id);
        if (! $post) {
            return response()->json(['message' => 'Institutional post not found.'], 404);
        }
        $post->delete();

        return response()->json(['message' => 'Institutional post deleted.']);
    }
}
