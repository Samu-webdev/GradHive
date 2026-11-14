<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicWork;
use App\Models\InstitutionHighlight;
use App\Models\InstitutionPost;
use App\Models\Opportunity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeedController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $activities = collect();
        $works = AcademicWork::with('author')->where('visibility', 'public')
            ->whereHas('author', fn ($author) => $author->where('status', 'active'))
            ->latest()->limit(50)->get();
        foreach ($works as $work) {
            $activities->push([
                'type' => 'work',
                'created_at' => $work->created_at?->toIso8601String(),
                '_sort' => $work->created_at?->timestamp ?? 0,
                'data' => $work->present(),
            ]);
        }

        $opportunities = Opportunity::with('owner')->where('status', 'open')
            ->whereHas('owner', fn ($owner) => $owner->where('status', 'active'))
            ->latest()->limit(50)->get();
        foreach ($opportunities as $opportunity) {
            $activities->push([
                'type' => 'opportunity',
                'created_at' => $opportunity->created_at?->toIso8601String(),
                '_sort' => $opportunity->created_at?->timestamp ?? 0,
                'data' => $opportunity->present(),
            ]);
        }

        $highlights = InstitutionHighlight::with(['institution', 'student'])
            ->whereHas('institution', fn ($institution) => $institution->where('status', 'active')
                ->where('institution_profile_visibility', 'public'))
            ->whereHas('student', fn ($student) => $student->where('status', 'active')->where('student_profile_visibility', 'public'))
            ->latest()->limit(50)->get();
        foreach ($highlights as $highlight) {
            $activities->push([
                'type' => 'highlight',
                'created_at' => $highlight->created_at?->toIso8601String(),
                '_sort' => $highlight->created_at?->timestamp ?? 0,
                'data' => [
                    'id' => $highlight->id,
                    'title' => $highlight->title,
                    'message' => $highlight->message,
                    'institution' => $highlight->institution?->toCard(),
                    'student' => $highlight->student?->toCard(),
                ],
            ]);
        }

        $posts = InstitutionPost::with('institution')->whereHas('institution', fn ($institution) => $institution
            ->where('role', 'school')->where('status', 'active')->where('institution_profile_visibility', 'public'))
            ->latest()->limit(50)->get();
        foreach ($posts as $post) {
            $activities->push([
                'type' => 'institution_post',
                'created_at' => $post->created_at?->toIso8601String(),
                '_sort' => $post->created_at?->timestamp ?? 0,
                'data' => $post->present(),
            ]);
        }

        $items = $activities->sortByDesc('_sort')->take(100)->map(function (array $activity) {
            unset($activity['_sort']);

            return $activity;
        })->values();

        return response()->json(['data' => $items, 'meta' => ['total' => $items->count()]]);
    }
}
