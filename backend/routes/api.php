<?php

use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PositionController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\UniversityController;
use App\Http\Controllers\Api\WorkController;
use Illuminate\Support\Facades\Route;

// ---- Routes publiques ----
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::get('/stats', [StatsController::class, 'index']);

Route::get('/works', [WorkController::class, 'index']);
Route::get('/works/{id}', [WorkController::class, 'show'])->whereNumber('id');

Route::get('/universities', [UniversityController::class, 'index']);
Route::get('/universities/{id}', [UniversityController::class, 'show'])->whereNumber('id');
Route::get('/positions', [PositionController::class, 'index']);
Route::get('/positions/{id}', [PositionController::class, 'show'])->whereNumber('id');
Route::post('/positions/{id}/check', [PositionController::class, 'check'])->whereNumber('id');

// ---- Routes protégées (jeton Sanctum) ----
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::post('/works', [WorkController::class, 'store']);
    Route::get('/works/{id}/download', [WorkController::class, 'download'])->whereNumber('id');
    Route::get('/my/works', [WorkController::class, 'mine']);

    Route::post('/positions/{id}/applications', [ApplicationController::class, 'store'])->whereNumber('id');
    Route::get('/my/applications', [ApplicationController::class, 'mine']);

});
