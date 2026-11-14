<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicWork;
use App\Models\Opportunity;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReportController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'target_type' => ['required', Rule::in(['member', 'work', 'opportunity'])],
            'target_id' => ['required', 'integer', 'min:1'],
            'reason' => ['required', Rule::in(['inaccurate', 'inappropriate', 'fraud', 'spam', 'other'])],
            'details' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);
        $target = match ($data['target_type']) {
            'member' => User::where('status', 'active')->where('role', '!=', 'admin')
                ->where(function ($visibility) use ($request) {
                    $visibility->where(fn ($student) => $student
                        ->where('role', 'student')->where('student_profile_visibility', 'public'))
                        ->orWhere(fn ($institution) => $institution
                            ->whereIn('role', ['school', 'company', 'organization'])
                            ->where('institution_profile_visibility', 'public'))
                        ->orWhereNotIn('role', ['student', 'school', 'company', 'organization'])
                        ->orWhere('id', $request->user()->id);
                })->find($data['target_id']),
            'work' => AcademicWork::where(function ($query) use ($request) {
                $query->where('visibility', 'public')->orWhere('author_id', $request->user()->id);
            })->find($data['target_id']),
            'opportunity' => Opportunity::where(function ($query) use ($request) {
                $query->where('status', 'open')->orWhere('owner_id', $request->user()->id);
            })->find($data['target_id']),
        };
        if (! $target) {
            return response()->json(['message' => 'The reported resource was not found.'], 404);
        }
        $ownerId = match ($data['target_type']) {
            'member' => $target->id,
            'work' => $target->author_id,
            'opportunity' => $target->owner_id,
        };
        if ($ownerId === $request->user()->id) {
            return response()->json(['message' => 'You cannot report your own content.'], 422);
        }
        $report = Report::firstOrCreate(
            [
                'reporter_id' => $request->user()->id,
                'target_type' => $data['target_type'],
                'target_id' => $data['target_id'],
            ],
            [
                'reason' => $data['reason'],
                'details' => isset($data['details']) ? trim($data['details']) : null,
                'status' => 'open',
            ]
        );
        if (! $report->wasRecentlyCreated) {
            return response()->json(['message' => 'You have already reported this resource.'], 409);
        }

        return response()->json(['data' => ['id' => $report->id, 'status' => $report->status]], 201);
    }
}
