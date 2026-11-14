<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicWork;
use App\Models\Position;
use App\Models\University;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class StatsController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'works' => AcademicWork::count(),
            'universities' => University::count(), 'positions' => Position::count(), 'users' => User::where('role', '!=', 'admin')->count(),
        ]);
    }
}
