<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Connection;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MemberController extends Controller
{
    public function publicSearch(Request $request): JsonResponse
    {
        $filters = $request->validate(['q' => ['required', 'string', 'min:2', 'max:150']]);
        $rawQuery = trim($filters['q']);
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], mb_strtolower($rawQuery)).'%';
        $rawLike = '%'.str_replace(['%', '_'], ['\%', '\_'], $rawQuery).'%';

        $query = User::query()->where('status', 'active')->where('role', '!=', 'admin')
            ->where(function ($visibility) {
                $visibility->where(fn ($student) => $student->where('role', 'student')->where('student_profile_visibility', 'public'))
                    ->orWhere(fn ($institution) => $institution->whereIn('role', ['school', 'company', 'organization'])
                        ->where('institution_profile_visibility', 'public'))
                    ->orWhereNotIn('role', ['student', 'school', 'company', 'organization']);
            })
            ->where(fn ($search) => $search->whereRaw('LOWER(name) LIKE ?', [$like])
                ->orWhereRaw('LOWER(COALESCE(headline, \'\')) LIKE ?', [$like])
                ->orWhereRaw('LOWER(COALESCE(institution, \'\')) LIKE ?', [$like])
                ->orWhereRaw('LOWER(COALESCE(field_of_study, \'\')) LIKE ?', [$like])
                ->orWhere('name', 'LIKE', $rawLike)
                ->orWhere('headline', 'LIKE', $rawLike)
                ->orWhere('institution', 'LIKE', $rawLike)
                ->orWhere('field_of_study', 'LIKE', $rawLike));

        $total = (clone $query)->count();
        $members = $query->orderBy('name')->limit(20)->get();

        return response()->json([
            'data' => $members->map(fn (User $member) => $member->toCard())->values(),
            'meta' => ['total' => $total],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['sometimes', 'string', 'max:150'],
            'role' => ['sometimes', 'in:student,school,company,mentor,organization'],
            'country' => ['sometimes', 'string', 'max:80'],
            'institution' => ['sometimes', 'string', 'max:150'],
        ]);
        $query = User::where('status', 'active')->where('role', '!=', 'admin')
            ->where(function ($visibility) use ($request) {
                $visibility->where(function ($student) {
                    $student->where('role', 'student')->where('student_profile_visibility', 'public');
                })->orWhere(function ($institution) {
                    $institution->whereIn('role', ['school', 'company', 'organization'])
                        ->where('institution_profile_visibility', 'public');
                })->orWhereNotIn('role', ['student', 'school', 'company', 'organization']);
                $visibility->orWhere('id', $request->user()->id);
            });

        if (isset($filters['role'])) {
            $query->where('role', $filters['role']);
        }
        foreach (['country', 'institution'] as $field) {
            if (! empty($filters[$field])) {
                $rawFilter = trim($filters[$field]);
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], mb_strtolower($rawFilter)).'%';
                $rawLike = '%'.str_replace(['%', '_'], ['\%', '\_'], $rawFilter).'%';
                $query->where(fn ($filter) => $filter
                    ->whereRaw("LOWER(COALESCE({$field}, '')) LIKE ?", [$like])
                    ->orWhere($field, 'LIKE', $rawLike));
            }
        }
        if (! empty($filters['q'])) {
            $rawQuery = trim($filters['q']);
            $like = '%'.str_replace(['%', '_'], ['\%', '\_'], mb_strtolower($rawQuery)).'%';
            $rawLike = '%'.str_replace(['%', '_'], ['\%', '\_'], $rawQuery).'%';
            $query->where(fn ($search) => $search->whereRaw('LOWER(name) LIKE ?', [$like])
                ->orWhereRaw('LOWER(COALESCE(headline, \'\')) LIKE ?', [$like])
                ->orWhereRaw('LOWER(COALESCE(institution, \'\')) LIKE ?', [$like])
                ->orWhereRaw('LOWER(COALESCE(field_of_study, \'\')) LIKE ?', [$like])
                ->orWhere('name', 'LIKE', $rawLike)
                ->orWhere('headline', 'LIKE', $rawLike)
                ->orWhere('institution', 'LIKE', $rawLike)
                ->orWhere('field_of_study', 'LIKE', $rawLike));
        }

        $total = (clone $query)->count();
        $members = $query->orderBy('name')->limit(100)->get();
        $memberIds = $members->pluck('id');
        $viewerId = $request->user()->id;
        $connections = Connection::query()
            ->where(fn ($query) => $query
                ->where(fn ($outgoing) => $outgoing->where('requester_id', $viewerId)->whereIn('recipient_id', $memberIds))
                ->orWhere(fn ($incoming) => $incoming->where('recipient_id', $viewerId)->whereIn('requester_id', $memberIds)))
            ->get(['requester_id', 'recipient_id', 'status'])
            ->keyBy(fn (Connection $connection) => (int) $connection->requester_id === $viewerId
                ? $connection->recipient_id : $connection->requester_id);

        return response()->json([
            'data' => $members->map(function (User $member) use ($connections, $viewerId) {
                $connection = $connections->get($member->id);
                $connectionState = $member->id === $viewerId
                    ? 'self'
                    : match ($connection?->status) {
                        'accepted' => 'connected',
                        'pending' => (int) $connection->requester_id === $viewerId ? 'pending_out' : 'pending_in',
                        default => 'none',
                    };

                return array_merge($member->toCard(), ['connection' => $connectionState]);
            })->values(),
            'meta' => ['total' => $total],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $member = User::whereKey($id)->where('status', 'active')->where('role', '!=', 'admin')->first();
        if (! $member || ! $this->visibleTo($member, $request->user())) {
            return response()->json(['message' => 'Member not found.'], 404);
        }

        return response()->json(['data' => array_merge($member->toCard(), [
            'bio' => $member->bio,
            'website' => $member->website,
        ])]);
    }

    private function visibleTo(User $member, ?User $viewer): bool
    {
        if ($viewer && $member->id === $viewer->id) {
            return true;
        }

        return match ($member->role) {
            'student' => $member->student_profile_visibility === 'public',
            'school', 'company', 'organization' => $member->institution_profile_visibility === 'public',
            'admin' => false,
            default => true,
        };
    }
}
