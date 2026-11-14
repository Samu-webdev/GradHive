<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicWork;
use App\Models\Application;
use App\Models\Opportunity;
use App\Models\OpportunityApplication;
use App\Models\Position;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function dashboard(): JsonResponse
    {
        return response()->json(['data' => [
            'accounts' => [
                'total' => User::count(),
                'active' => User::where('status', 'active')->count(),
                'suspended' => User::where('status', 'suspended')->count(),
                'by_role' => User::selectRaw('role, COUNT(*) as total')->groupBy('role')
                    ->pluck('total', 'role'),
            ],
            'opportunities' => [
                'total' => Opportunity::count(),
                'open' => Opportunity::where('status', 'open')->count(),
                'ta_ra_positions' => Position::count(),
            ],
            'academic_works' => AcademicWork::count(),
            'opportunity_applications' => OpportunityApplication::count(),
            'ta_ra_applications' => Application::count(),
            'open_reports' => Report::where('status', 'open')->count(),
        ]]);
    }

    public function users(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['sometimes', 'string', 'max:150'],
            'role' => ['sometimes', 'in:student,school,company,mentor,organization,admin'],
            'status' => ['sometimes', 'in:active,suspended'],
        ]);
        $query = User::query();
        if (! empty($filters['role'])) {
            $query->where('role', $filters['role']);
        }
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['q'])) {
            $like = '%'.str_replace(['%', '_'], ['\%', '\_'], mb_strtolower(trim($filters['q']))).'%';
            $query->where(fn ($search) => $search->whereRaw('LOWER(name) LIKE ?', [$like])
                ->orWhereRaw('LOWER(email) LIKE ?', [$like]));
        }
        $total = (clone $query)->count();
        $users = $query->orderBy('id')->limit(100)->get();

        return response()->json([
            'data' => $users->map(fn (User $user) => [
                'id' => $user->id, 'name' => $user->name, 'email' => $user->email,
                'role' => $user->role, 'status' => $user->status,
                'created_at' => $user->created_at?->toIso8601String(),
            ])->values(),
            'meta' => ['total' => $total],
        ]);
    }

    public function suspend(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        abort_if($user->id === $request->user()->id, 422, 'Administrators cannot suspend their own account.');
        $user->update(['status' => 'suspended']);

        return response()->json(['data' => ['id' => $user->id, 'status' => $user->status]]);
    }

    public function reactivate(int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $user->update(['status' => 'active']);

        return response()->json(['data' => ['id' => $user->id, 'status' => $user->status]]);
    }
}
