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

class AdminReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['sometimes', Rule::in(['open', 'reviewed', 'dismissed'])],
            'target_type' => ['sometimes', Rule::in(['member', 'work', 'opportunity'])],
        ]);
        $query = Report::with('reporter:id,name,role')->latest();
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (isset($filters['target_type'])) {
            $query->where('target_type', $filters['target_type']);
        }
        $total = (clone $query)->count();
        $reports = $query->limit(100)->get()->map(fn (Report $report) => [
            'id' => $report->id,
            'reporter' => $report->reporter ? [
                'id' => $report->reporter->id,
                'name' => $report->reporter->name,
                'role' => $report->reporter->role,
            ] : null,
            'target_type' => $report->target_type,
            'target_id' => $report->target_id,
            'target_label' => $this->targetLabel($report),
            'reason' => $report->reason,
            'details' => $report->details,
            'status' => $report->status,
            'admin_note' => $report->admin_note,
            'created_at' => $report->created_at?->toIso8601String(),
        ])->values();

        return response()->json(['data' => $reports, 'meta' => ['total' => $total]]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $report = Report::findOrFail($id);
        $data = $request->validate([
            'status' => ['required', Rule::in(['reviewed', 'dismissed'])],
            'admin_note' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);
        $report->update($data + ['reviewer_id' => $request->user()->id]);

        return response()->json(['data' => ['id' => $report->id, 'status' => $report->status]]);
    }

    private function targetLabel(Report $report): ?string
    {
        return match ($report->target_type) {
            'member' => User::whereKey($report->target_id)->value('name'),
            'work' => AcademicWork::whereKey($report->target_id)->value('title'),
            'opportunity' => Opportunity::whereKey($report->target_id)->value('title'),
            default => null,
        };
    }
}
