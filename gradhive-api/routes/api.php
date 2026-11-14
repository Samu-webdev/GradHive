<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminReportController;
use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ConnectionController;
use App\Http\Controllers\Api\FeedController;
use App\Http\Controllers\Api\InstitutionPostController;
use App\Http\Controllers\Api\MemberController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OpportunityController;
use App\Http\Controllers\Api\PositionController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\UniversityController;
use App\Http\Controllers\Api\WorkController;
use Illuminate\Support\Facades\Route;

// ---- Routes publiques ----
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::get('/stats', [StatsController::class, 'index']);

Route::get('/works', [WorkController::class, 'index'])->middleware('optional.sanctum')->name('api.works.index');
Route::get('/works/{id}', [WorkController::class, 'show'])->whereNumber('id')->middleware('optional.sanctum')->name('api.works.show');
Route::get('/works/{id}/download', [WorkController::class, 'download'])
    ->whereNumber('id')->middleware('optional.sanctum')->name('api.works.download');
Route::get('/students/{id}/profile', [ProfileController::class, 'student'])->whereNumber('id')->name('api.profile.student');
Route::get('/institutions/{id}/profile', [ProfileController::class, 'institution'])->whereNumber('id')->name('api.profile.institution');

Route::get('/universities', [UniversityController::class, 'index']);
Route::get('/universities/{id}', [UniversityController::class, 'show'])->whereNumber('id');
Route::get('/positions', [PositionController::class, 'index']);
Route::get('/positions/{id}', [PositionController::class, 'show'])->whereNumber('id');
Route::post('/positions/{id}/check', [PositionController::class, 'check'])->whereNumber('id');
Route::get('/opportunities', [OpportunityController::class, 'index'])->middleware('optional.sanctum');
Route::get('/opportunities/{id}', [OpportunityController::class, 'show'])->whereNumber('id')->middleware('optional.sanctum');
Route::get('/feed', [FeedController::class, 'index'])->name('api.feed.index');
Route::get('/search/members', [MemberController::class, 'publicSearch'])->middleware('throttle:60,1')->name('api.search.members');
Route::get('/members/{id}', [MemberController::class, 'show'])->whereNumber('id')->middleware('optional.sanctum');

// ---- Routes protégées (jeton Sanctum) ----
Route::middleware('auth:sanctum')->group(function () {
    Route::middleware('active')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::get('/my/profile', [ProfileController::class, 'mine'])->name('api.profile.mine');
        Route::put('/my/profile', [ProfileController::class, 'updateMine'])->name('api.profile.update');
        Route::patch('/my/profile', [ProfileController::class, 'updateMine'])->name('api.profile.patch');
        Route::get('/members', [MemberController::class, 'index'])->name('api.members.index');
        Route::get('/connections', [ConnectionController::class, 'index'])->name('api.connections.index');
        Route::post('/connections', [ConnectionController::class, 'store'])->name('api.connections.store');
        Route::patch('/connections/{id}/accept', [ConnectionController::class, 'accept'])->whereNumber('id')->name('api.connections.accept');
        Route::patch('/connections/{id}/decline', [ConnectionController::class, 'decline'])->whereNumber('id')->name('api.connections.decline');
        Route::delete('/connections/{id}', [ConnectionController::class, 'destroy'])->whereNumber('id')->name('api.connections.destroy');
        Route::get('/notifications', [NotificationController::class, 'index'])->name('api.notifications.index');
        Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead'])->name('api.notifications.read-all');
        Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead'])->name('api.notifications.read');
        Route::post('/reports', [ReportController::class, 'store'])->name('api.reports.store');

        Route::post('/opportunities/{id}/favorite', [OpportunityController::class, 'favorite'])->whereNumber('id')->middleware('role:student');
        Route::delete('/opportunities/{id}/favorite', [OpportunityController::class, 'unfavorite'])->whereNumber('id')->middleware('role:student');
        Route::get('/my/favorite-opportunities', [OpportunityController::class, 'favorites'])->middleware('role:student');
        Route::get('/opportunity-applications/{applicationId}/documents/{documentId}', [OpportunityController::class, 'downloadDocument'])
            ->whereNumber('applicationId')->whereNumber('documentId');

        Route::middleware('role:school,company,organization')->group(function () {
            Route::get('/my/opportunities', [OpportunityController::class, 'mine'])->name('api.opportunities.mine');
            Route::post('/opportunities', [OpportunityController::class, 'store'])->name('api.opportunities.store');
            Route::put('/opportunities/{id}', [OpportunityController::class, 'update'])->whereNumber('id');
            Route::patch('/opportunities/{id}', [OpportunityController::class, 'update'])->whereNumber('id');
            Route::delete('/opportunities/{id}', [OpportunityController::class, 'destroy'])->whereNumber('id');
            Route::get('/my/opportunities/{id}/applications', [OpportunityController::class, 'receivedApplications'])->whereNumber('id');
            Route::patch('/opportunities/{opportunityId}/applications/{applicationId}/status', [OpportunityController::class, 'changeApplicationStatus'])
                ->whereNumber('opportunityId')->whereNumber('applicationId');
        });

        Route::middleware('role:school')->group(function () {
            Route::get('/my/institution/highlights', [ProfileController::class, 'highlights'])->name('api.institution.highlights.index');
            Route::post('/my/institution/highlights', [ProfileController::class, 'storeHighlight'])->name('api.institution.highlights.store');
            Route::put('/my/institution/highlights/{id}', [ProfileController::class, 'updateHighlight'])->whereNumber('id')->name('api.institution.highlights.update');
            Route::delete('/my/institution/highlights/{id}', [ProfileController::class, 'destroyHighlight'])->whereNumber('id')->name('api.institution.highlights.destroy');
            Route::get('/my/institution/eligible-students', [ProfileController::class, 'eligibleStudents'])->name('api.institution.highlights.eligible-students');
            Route::patch('/my/institution/highlights/order', [ProfileController::class, 'reorderHighlights'])->name('api.institution.highlights.reorder');
            Route::get('/my/institution/posts', [InstitutionPostController::class, 'index'])->name('api.institution.posts.index');
            Route::post('/my/institution/posts', [InstitutionPostController::class, 'store'])->name('api.institution.posts.store');
            Route::put('/my/institution/posts/{id}', [InstitutionPostController::class, 'update'])->whereNumber('id')->name('api.institution.posts.update');
            Route::patch('/my/institution/posts/{id}', [InstitutionPostController::class, 'update'])->whereNumber('id');
            Route::delete('/my/institution/posts/{id}', [InstitutionPostController::class, 'destroy'])->whereNumber('id')->name('api.institution.posts.destroy');
        });

        Route::middleware('role:student')->group(function () {
            Route::post('/works', [WorkController::class, 'store'])->name('api.works.store');
            Route::put('/works/{id}', [WorkController::class, 'update'])->whereNumber('id')->name('api.works.update');
            Route::patch('/works/{id}', [WorkController::class, 'update'])->whereNumber('id');
            Route::delete('/works/{id}', [WorkController::class, 'destroy'])->whereNumber('id')->name('api.works.destroy');
            Route::get('/my/works', [WorkController::class, 'mine'])->name('api.works.mine');
            Route::post('/positions/{id}/applications', [ApplicationController::class, 'store'])->whereNumber('id')->name('api.applications.store');
            Route::get('/my/applications', [ApplicationController::class, 'mine'])->name('api.applications.mine');
            Route::post('/opportunities/{id}/applications', [OpportunityController::class, 'apply'])->whereNumber('id');
            Route::get('/my/opportunity-applications', [OpportunityController::class, 'myApplications']);
            Route::get('/my/opportunity-applications/{id}', [OpportunityController::class, 'myApplication'])->whereNumber('id');
            Route::patch('/my/opportunity-applications/{id}/withdraw', [OpportunityController::class, 'withdraw'])->whereNumber('id');
        });

        Route::middleware('role:admin')->prefix('admin')->group(function () {
            Route::get('/dashboard', [AdminController::class, 'dashboard']);
            Route::get('/users', [AdminController::class, 'users']);
            Route::get('/reports', [AdminReportController::class, 'index']);
            Route::patch('/reports/{id}', [AdminReportController::class, 'update'])->whereNumber('id');
            Route::patch('/users/{id}/suspend', [AdminController::class, 'suspend'])->whereNumber('id');
            Route::patch('/users/{id}/reactivate', [AdminController::class, 'reactivate'])->whereNumber('id');
        });
    });
});
