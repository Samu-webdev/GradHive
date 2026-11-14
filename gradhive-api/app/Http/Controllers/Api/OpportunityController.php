<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Opportunity;
use App\Models\OpportunityApplication;
use App\Models\OpportunityApplicationStatusHistory;
use App\Models\User;
use App\Notifications\GradHiveNotification;
use App\Services\PdfStorage;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class OpportunityController extends Controller
{
    private const PUBLISHER_ROLES = ['school', 'company', 'organization'];

    private const STATUSES = ['submitted', 'under_review', 'shortlisted', 'accepted', 'rejected', 'withdrawn'];

    private const DOCUMENT_TYPES = [
        'cv', 'transcripts', 'motivation_letter', 'recommendation_letter',
        'research_proposal', 'language_certificate', 'passport', 'other',
    ];

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['sometimes', 'string', 'max:200'],
            'type' => ['sometimes', Rule::in(Opportunity::TYPES)],
            'location' => ['sometimes', 'string', 'max:150'],
            'country' => ['sometimes', 'string', 'max:80'],
            'study_level' => ['sometimes', Rule::in(['licence', 'master', 'doctorat'])],
            'remote' => ['sometimes', 'boolean'],
            'owner_id' => ['sometimes', 'integer', 'min:1'],
        ]);
        $query = Opportunity::with('owner')
            ->where('status', 'open')
            ->whereHas('owner', fn ($owner) => $owner->where('status', 'active'));

        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }
        if (isset($filters['owner_id'])) {
            $query->where('owner_id', $filters['owner_id']);
        }
        if (isset($filters['remote'])) {
            $query->where('remote', $filters['remote']);
        }
        if (! empty($filters['location'])) {
            $like = '%'.str_replace(['%', '_'], ['\%', '\_'], mb_strtolower(trim($filters['location']))).'%';
            $query->whereRaw('LOWER(COALESCE(location, \'\')) LIKE ?', [$like]);
        }
        if (! empty($filters['country'])) {
            $like = '%'.str_replace(['%', '_'], ['\%', '\_'], mb_strtolower(trim($filters['country']))).'%';
            $query->whereRaw('LOWER(COALESCE(country, \'\')) LIKE ?', [$like]);
        }
        if (! empty($filters['study_level'])) {
            $query->where(fn ($query) => $query->whereNull('study_level')->orWhere('study_level', $filters['study_level']));
        }
        if (! empty($filters['q'])) {
            $like = '%'.str_replace(['%', '_'], ['\%', '\_'], mb_strtolower(trim($filters['q']))).'%';
            $query->where(fn ($search) => $search->whereRaw('LOWER(title) LIKE ?', [$like])
                ->orWhereRaw('LOWER(description) LIKE ?', [$like])
                ->orWhereRaw('LOWER(COALESCE(organization_name, \'\')) LIKE ?', [$like]));
        }

        $total = (clone $query)->count();
        $items = $query->latest()->limit(100)->get();
        $favorites = $request->user()?->role === 'student'
            ? DB::table('opportunity_favorites')->where('user_id', $request->user()->id)
                ->whereIn('opportunity_id', $items->pluck('id'))->pluck('opportunity_id')->all()
            : [];

        return response()->json([
            'data' => $items->map(fn (Opportunity $item) => $item->present(in_array($item->id, $favorites)))->values(),
            'meta' => ['total' => $total],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $opportunity = Opportunity::with('owner')->whereKey($id)
            ->whereHas('owner', fn ($owner) => $owner->where('status', 'active'))->first();
        if (! $opportunity || ($opportunity->status !== 'open' && $request->user()?->id !== $opportunity->owner_id)) {
            return response()->json(['message' => 'Opportunity not found.'], 404);
        }

        return response()->json(['data' => $opportunity->present($this->isFavorited($request, $opportunity))]);
    }

    public function mine(Request $request): JsonResponse
    {
        $this->authorizeRole($request, self::PUBLISHER_ROLES);
        $items = Opportunity::with('owner')->where('owner_id', $request->user()->id)->latest()->get();

        return response()->json(['data' => $items->map->present()->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeRole($request, self::PUBLISHER_ROLES);
        $data = $this->validated($request);
        $opportunity = DB::transaction(function () use ($data, $request) {
            $opportunity = Opportunity::create($data + ['owner_id' => $request->user()->id]);
            if (($data['status'] ?? 'open') === 'open') {
                $this->notifyActiveStudents($opportunity);
            }

            return $opportunity;
        });
        $opportunity->load('owner');

        return response()->json(['data' => $opportunity->present()], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $opportunity = Opportunity::find($id);
        if (! $opportunity) {
            return response()->json(['message' => 'Opportunity not found.'], 404);
        }
        $this->authorizeRole($request, self::PUBLISHER_ROLES);
        abort_unless($opportunity->owner_id === $request->user()->id, 403, 'Only the opportunity owner may edit it.');

        $wasOpen = $opportunity->status === 'open';
        DB::transaction(function () use ($opportunity, $request, $wasOpen): void {
            $opportunity->fill($this->validated($request, false))->save();
            if (! $wasOpen && $opportunity->status === 'open') {
                $this->notifyActiveStudents($opportunity);
            }
        });
        $opportunity->load('owner');

        return response()->json(['data' => $opportunity->present()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $opportunity = Opportunity::find($id);
        if (! $opportunity) {
            return response()->json(['message' => 'Opportunity not found.'], 404);
        }
        $this->authorizeRole($request, self::PUBLISHER_ROLES);
        abort_unless($opportunity->owner_id === $request->user()->id, 403, 'Only the opportunity owner may delete it.');
        if ($opportunity->applications()->exists()) {
            return response()->json(['message' => 'Close opportunities with applications instead of deleting them.'], 409);
        }
        $opportunity->delete();

        return response()->json(['message' => 'Opportunity deleted.']);
    }

    public function favorite(Request $request, int $id): JsonResponse
    {
        $this->authorizeRole($request, ['student']);
        $opportunity = Opportunity::whereKey($id)->where('status', 'open')->firstOrFail();
        DB::table('opportunity_favorites')->insertOrIgnore([
            'opportunity_id' => $opportunity->id,
            'user_id' => $request->user()->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Opportunity saved.']);
    }

    public function unfavorite(Request $request, int $id): JsonResponse
    {
        $this->authorizeRole($request, ['student']);
        DB::table('opportunity_favorites')->where('opportunity_id', $id)
            ->where('user_id', $request->user()->id)->delete();

        return response()->json(['message' => 'Opportunity removed from saved items.']);
    }

    public function favorites(Request $request): JsonResponse
    {
        $this->authorizeRole($request, ['student']);
        $items = Opportunity::with('owner')
            ->join('opportunity_favorites', 'opportunities.id', '=', 'opportunity_favorites.opportunity_id')
            ->where('opportunity_favorites.user_id', $request->user()->id)
            ->where('opportunities.status', 'open')
            ->whereHas('owner', fn ($owner) => $owner->where('status', 'active'))
            ->select('opportunities.*')->latest('opportunity_favorites.created_at')->get();

        return response()->json(['data' => $items->map(fn (Opportunity $item) => $item->present(true))->values()]);
    }

    public function apply(Request $request, int $id, PdfStorage $pdfStorage): JsonResponse
    {
        $this->authorizeRole($request, ['student']);
        $opportunity = Opportunity::whereKey($id)->where('status', 'open')->first();
        if (! $opportunity || ($opportunity->deadline && $opportunity->deadline->toDateString() < today()->toDateString())) {
            return response()->json(['message' => 'Opportunity is not accepting applications.'], 404);
        }
        if (OpportunityApplication::where('opportunity_id', $id)->where('user_id', $request->user()->id)->exists()) {
            return response()->json(['message' => 'You have already applied.'], 409);
        }

        $rules = [
            'motivation' => ['nullable', 'string', 'min:20', 'max:5000'],
            'documents' => ['sometimes', 'array', 'max:7'],
            'documents.*' => ['file', 'mimes:pdf', 'mimetypes:application/pdf', 'max:5120'],
        ];
        foreach ($opportunity->required_documents ?? [] as $documentType) {
            $rules["documents.{$documentType}"] = ['required', 'file', 'mimes:pdf', 'mimetypes:application/pdf', 'max:5120'];
        }
        $data = $request->validate($rules);
        $stored = [];
        try {
            foreach ((array) $request->file('documents', []) as $documentType => $file) {
                $stored[] = [
                    'path' => $pdfStorage->store($file, "opportunity-applications/{$opportunity->id}/{$request->user()->id}"),
                    'name' => $this->safeName($file->getClientOriginalName()),
                    'type' => is_string($documentType) ? $documentType : 'other',
                ];
            }
            $application = DB::transaction(function () use ($data, $opportunity, $request, $stored) {
                $application = OpportunityApplication::create([
                    'opportunity_id' => $opportunity->id,
                    'user_id' => $request->user()->id,
                    'motivation' => isset($data['motivation']) ? trim($data['motivation']) : null,
                    'documents' => $stored,
                    'status' => 'submitted',
                ]);
                OpportunityApplicationStatusHistory::create([
                    'application_id' => $application->id,
                    'actor_id' => $request->user()->id,
                    'from_status' => null,
                    'to_status' => 'submitted',
                ]);

                return $application;
            });
        } catch (QueryException $exception) {
            $pdfStorage->delete(array_column($stored, 'path'));
            if (OpportunityApplication::where('opportunity_id', $id)->where('user_id', $request->user()->id)->exists()) {
                return response()->json(['message' => 'You have already applied.'], 409);
            }
            throw $exception;
        } catch (Throwable $exception) {
            $pdfStorage->delete(array_column($stored, 'path'));
            throw $exception;
        }

        $opportunity->owner->notify(new GradHiveNotification([
            'event' => 'opportunity_application_received',
            'opportunity_id' => $opportunity->id,
            'application_id' => $application->id,
        ]));

        return response()->json(['data' => $application->present()], 201);
    }

    public function myApplications(Request $request): JsonResponse
    {
        $this->authorizeRole($request, ['student']);
        $items = OpportunityApplication::with('opportunity.owner')->where('user_id', $request->user()->id)->latest()->get();

        return response()->json(['data' => $items->map(fn (OpportunityApplication $item) => array_merge(
            $item->present(),
            ['opportunity' => $item->opportunity->present(), 'history' => $this->history($item)]
        ))->values()]);
    }

    public function myApplication(Request $request, int $id): JsonResponse
    {
        $this->authorizeRole($request, ['student']);
        $application = OpportunityApplication::with('opportunity.owner')
            ->whereKey($id)->where('user_id', $request->user()->id)->firstOrFail();

        return response()->json(['data' => array_merge(
            $application->present(),
            ['opportunity' => $application->opportunity->present(), 'history' => $this->history($application)]
        )]);
    }

    public function receivedApplications(Request $request, int $id): JsonResponse
    {
        $this->authorizeRole($request, self::PUBLISHER_ROLES);
        $opportunity = Opportunity::whereKey($id)->firstOrFail();
        abort_unless($opportunity->owner_id === $request->user()->id, 403, 'Only the opportunity owner may review applications.');
        $items = $opportunity->applications()->with('applicant')->latest()->get();

        return response()->json(['data' => $items->map(fn (OpportunityApplication $item) => array_merge(
            $item->present(true),
            ['history' => $this->history($item)]
        ))->values()]);
    }

    public function changeApplicationStatus(Request $request, int $opportunityId, int $applicationId): JsonResponse
    {
        $this->authorizeRole($request, self::PUBLISHER_ROLES);
        $opportunity = Opportunity::whereKey($opportunityId)->firstOrFail();
        abort_unless($opportunity->owner_id === $request->user()->id, 403, 'Only the opportunity owner may review applications.');
        $application = $opportunity->applications()->whereKey($applicationId)->firstOrFail();
        $data = $request->validate(['status' => ['required', Rule::in(['under_review', 'shortlisted', 'accepted', 'rejected'])]]);
        if (! $this->canTransition($application->status, $data['status'])) {
            return response()->json(['message' => 'This application status transition is not allowed.'], 422);
        }

        $changed = DB::transaction(function () use ($application, $data, $request) {
            $locked = OpportunityApplication::whereKey($application->id)->lockForUpdate()->firstOrFail();
            if (! $this->canTransition($locked->status, $data['status'])) {
                return false;
            }
            OpportunityApplicationStatusHistory::create([
                'application_id' => $locked->id,
                'actor_id' => $request->user()->id,
                'from_status' => $locked->status,
                'to_status' => $data['status'],
            ]);
            $locked->update(['status' => $data['status']]);

            return true;
        });
        if (! $changed) {
            return response()->json(['message' => 'This application status transition is not allowed.'], 422);
        }
        $application->refresh();
        $application->applicant->notify(new GradHiveNotification([
            'event' => 'opportunity_application_status_changed',
            'opportunity_id' => $opportunity->id,
            'application_id' => $application->id,
            'status' => $data['status'],
        ]));

        return response()->json([
            'data' => array_merge($application->fresh()->present(), ['history' => $this->history($application)]),
        ]);
    }

    public function withdraw(Request $request, int $id): JsonResponse
    {
        $this->authorizeRole($request, ['student']);
        $application = OpportunityApplication::whereKey($id)->where('user_id', $request->user()->id)->firstOrFail();
        if (! in_array($application->status, ['submitted', 'under_review', 'shortlisted'], true)) {
            return response()->json(['message' => 'This application cannot be withdrawn.'], 422);
        }
        $changed = DB::transaction(function () use ($application, $request) {
            $locked = OpportunityApplication::whereKey($application->id)->lockForUpdate()->firstOrFail();
            if (! in_array($locked->status, ['submitted', 'under_review', 'shortlisted'], true)) {
                return false;
            }
            OpportunityApplicationStatusHistory::create([
                'application_id' => $locked->id,
                'actor_id' => $request->user()->id,
                'from_status' => $locked->status,
                'to_status' => 'withdrawn',
            ]);
            $locked->update(['status' => 'withdrawn']);

            return true;
        });
        if (! $changed) {
            return response()->json(['message' => 'This application cannot be withdrawn.'], 422);
        }
        $application->refresh();
        $application->opportunity->owner->notify(new GradHiveNotification([
            'event' => 'opportunity_application_withdrawn',
            'opportunity_id' => $application->opportunity_id,
            'application_id' => $application->id,
        ]));

        return response()->json(['data' => $application->present()]);
    }

    public function downloadDocument(Request $request, int $applicationId, int $documentId): Response
    {
        $application = OpportunityApplication::with('opportunity')->find($applicationId);
        if (! $application) {
            return response()->json(['message' => 'Document not found.'], 404);
        }
        $this->authorizeRole($request, ['student', ...self::PUBLISHER_ROLES]);
        $isApplicant = $application->user_id === $request->user()->id;
        $isOwner = $application->opportunity->owner_id === $request->user()->id;
        abort_unless($isApplicant || $isOwner, 403, 'You may not access these application documents.');
        $document = $application->documents[$documentId] ?? null;
        if (! $document || ! Storage::disk(config('gradhive.files_disk'))->exists($document['path'])) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        return Storage::disk(config('gradhive.files_disk'))->download($document['path'], $document['name']);
    }

    private function validated(Request $request, bool $creating = true): array
    {
        return $request->validate([
            'type' => [$creating ? 'required' : 'sometimes', Rule::in(Opportunity::TYPES)],
            'title' => [$creating ? 'required' : 'sometimes', 'string', 'min:3', 'max:200'],
            'organization_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'location' => ['sometimes', 'nullable', 'string', 'max:150'],
            'country' => ['sometimes', 'nullable', 'string', 'max:80'],
            'remote' => ['sometimes', 'boolean'],
            'employment_type' => ['sometimes', 'nullable', 'string', 'max:30'],
            'funding' => ['sometimes', 'nullable', 'string', 'max:150'],
            'deadline' => ['sometimes', 'nullable', 'date', 'after_or_equal:today'],
            'description' => [$creating ? 'required' : 'sometimes', 'string', 'min:20', 'max:10000'],
            'study_level' => ['sometimes', 'nullable', Rule::in(['licence', 'master', 'doctorat'])],
            'requirements' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'skills' => ['sometimes', 'array', 'max:30'],
            'skills.*' => ['string', 'max:80'],
            'required_documents' => ['sometimes', 'array', 'max:7'],
            'required_documents.*' => ['string', 'distinct', Rule::in(self::DOCUMENT_TYPES)],
            'application_method' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'status' => ['sometimes', Rule::in(['draft', 'open', 'closed'])],
        ]);
    }

    private function isFavorited(Request $request, Opportunity $opportunity): bool
    {
        return $request->user()?->role === 'student'
            && DB::table('opportunity_favorites')->where('opportunity_id', $opportunity->id)
                ->where('user_id', $request->user()->id)->exists();
    }

    private function notifyActiveStudents(Opportunity $opportunity): void
    {
        User::where('role', 'student')->where('status', 'active')->each(
            fn (User $student) => $student->notify(new GradHiveNotification([
                'event' => 'opportunity_published',
                'opportunity_id' => $opportunity->id,
            ]))
        );
    }

    private function canTransition(string $current, string $next): bool
    {
        return in_array($next, match ($current) {
            'submitted' => ['under_review', 'shortlisted', 'rejected'],
            'under_review' => ['shortlisted', 'accepted', 'rejected'],
            'shortlisted' => ['accepted', 'rejected'],
            default => [],
        }, true);
    }

    private function history(OpportunityApplication $application): array
    {
        return $application->history()->with('actor:id,name,role')->oldest()->get()->map(fn ($entry) => [
            'from_status' => $entry->from_status,
            'to_status' => $entry->to_status,
            'actor' => $entry->actor ? ['id' => $entry->actor->id, 'name' => $entry->actor->name, 'role' => $entry->actor->role] : null,
            'created_at' => $entry->created_at?->toIso8601String(),
        ])->all();
    }

    private function safeName(string $name): string
    {
        return mb_substr(basename(str_replace('\\', '/', $name)), 0, 120);
    }
}
