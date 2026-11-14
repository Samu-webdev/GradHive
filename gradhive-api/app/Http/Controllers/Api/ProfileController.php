<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InstitutionHighlight;
use App\Models\User;
use App\Notifications\GradHiveNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function mine(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['student', 'school'], true), 403, 'Profil indisponible pour votre rôle.');

        return response()->json(['data' => $this->profileData($user, true)]);
    }

    public function updateMine(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->authorize('updateProfile', $user);

        $rules = [
            'name' => ['sometimes', 'string', 'min:2', 'max:120'],
            'country' => ['sometimes', 'nullable', 'string', 'max:80'],
            'headline' => ['sometimes', 'nullable', 'string', 'max:120'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'website' => ['sometimes', 'nullable', 'url', 'max:255'],
        ];

        if ($user->role === 'student') {
            $rules += [
                'institution' => ['sometimes', 'nullable', 'string', 'max:150'],
                'field_of_study' => ['sometimes', 'nullable', 'string', 'max:120'],
                'level' => ['sometimes', 'nullable', 'in:licence,master,doctorat'],
                'student_profile_visibility' => ['sometimes', Rule::in(['private', 'public'])],
            ];
        } else {
            $rules['institution'] = ['sometimes', 'nullable', 'string', 'max:150'];
            $rules['institution_profile_visibility'] = ['sometimes', Rule::in(['private', 'public'])];
        }

        $user->fill($request->validate($rules));
        $user->save();

        return response()->json(['message' => 'Profil mis à jour.', 'data' => $this->profileData($user, true)]);
    }

    public function student(int $id): JsonResponse
    {
        $student = User::where('role', 'student')->find($id);
        if (! $student || $student->student_profile_visibility !== 'public') {
            return response()->json(['message' => 'Profil introuvable.'], 404);
        }

        return response()->json(['data' => $this->profileData($student)]);
    }

    public function institution(int $id): JsonResponse
    {
        $institution = User::where('role', 'school')->find($id);
        if (! $institution || $institution->institution_profile_visibility !== 'public') {
            return response()->json(['message' => 'Profil introuvable.'], 404);
        }

        $highlights = InstitutionHighlight::with('student')
            ->where('institution_user_id', $institution->id)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->whereHas('student', fn ($query) => $query
                ->where('role', 'student')
                ->where('student_profile_visibility', 'public')
                ->whereRaw('LOWER(TRIM(institution)) = ?', [mb_strtolower(trim((string) $institution->institution))]))
            ->latest()
            ->get()
            ->map(fn (InstitutionHighlight $highlight) => $this->highlightData($highlight))
            ->values();

        return response()->json(['data' => $this->profileData($institution) + ['highlights' => $highlights]]);
    }

    public function highlights(Request $request): JsonResponse
    {
        $institution = $request->user();
        $this->authorize('manageHighlights', $institution);

        $items = InstitutionHighlight::with('student')
            ->where('institution_user_id', $institution->id)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (InstitutionHighlight $highlight) => $this->highlightData($highlight))
            ->values();

        return response()->json(['data' => $items]);
    }

    public function eligibleStudents(Request $request): JsonResponse
    {
        $institution = $request->user();
        $this->authorize('manageHighlights', $institution);
        $filters = $request->validate(['q' => ['sometimes', 'string', 'max:120']]);
        $institutionName = mb_strtolower(trim((string) $institution->institution));
        if ($institutionName === '') {
            return response()->json(['data' => []]);
        }

        $query = User::query()
            ->where('role', 'student')
            ->where('student_profile_visibility', 'public')
            ->whereRaw('LOWER(TRIM(institution)) = ?', [$institutionName]);
        if (! empty($filters['q'])) {
            $rawQuery = trim($filters['q']);
            $term = '%'.str_replace(['%', '_'], ['\%', '\_'], mb_strtolower($rawQuery)).'%';
            $rawTerm = '%'.str_replace(['%', '_'], ['\%', '\_'], $rawQuery).'%';
            $query->where(function ($students) use ($term, $rawTerm): void {
                $students->whereRaw('LOWER(name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(field_of_study) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(headline) LIKE ?', [$term])
                    ->orWhere('name', 'LIKE', $rawTerm)
                    ->orWhere('field_of_study', 'LIKE', $rawTerm)
                    ->orWhere('headline', 'LIKE', $rawTerm);
            });
        }

        $students = $query->orderBy('name')->limit(50)->get([
            'id', 'name', 'country', 'institution', 'field_of_study', 'level', 'headline',
        ]);

        return response()->json(['data' => $students]);
    }

    public function storeHighlight(Request $request): JsonResponse
    {
        $institution = $request->user();
        $this->authorize('manageHighlights', $institution);
        $data = $request->validate([
            'student_id' => ['required', 'integer', 'exists:users,id'],
            'title' => ['required', 'string', 'min:2', 'max:120'],
            'message' => ['required', 'string', 'min:10', 'max:1000'],
        ]);
        $student = User::findOrFail($data['student_id']);
        $this->assertHighlightEligible($institution, $student);

        if (InstitutionHighlight::where('institution_user_id', $institution->id)
            ->where('student_user_id', $student->id)->exists()) {
            return response()->json(['message' => 'Cet étudiant est déjà mis en avant.'], 409);
        }

        $highlight = DB::transaction(function () use ($institution, $student, $data) {
            $highlight = InstitutionHighlight::create([
                'institution_user_id' => $institution->id,
                'student_user_id' => $student->id,
                'title' => trim($data['title']),
                'message' => trim($data['message']),
                'sort_order' => (int) InstitutionHighlight::where('institution_user_id', $institution->id)->max('sort_order') + 1,
            ]);
            $student->notify(new GradHiveNotification([
                'event' => 'student_highlighted',
                'institution_id' => $institution->id,
                'highlight_id' => $highlight->id,
            ]));

            return $highlight;
        });
        $highlight->load('student');

        return response()->json(['message' => 'Mise en avant créée.', 'data' => $this->highlightData($highlight)], 201);
    }

    public function updateHighlight(Request $request, int $id): JsonResponse
    {
        $institution = $request->user();
        $this->authorize('manageHighlights', $institution);
        $highlight = InstitutionHighlight::where('institution_user_id', $institution->id)->find($id);
        if (! $highlight) {
            return response()->json(['message' => 'Mise en avant introuvable.'], 404);
        }

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'min:2', 'max:120'],
            'message' => ['sometimes', 'string', 'min:10', 'max:1000'],
        ]);
        $highlight->fill(array_map(fn ($value) => trim($value), $data));
        $highlight->save();
        $highlight->load('student');

        return response()->json(['message' => 'Mise en avant mise à jour.', 'data' => $this->highlightData($highlight)]);
    }

    public function destroyHighlight(Request $request, int $id): JsonResponse
    {
        $institution = $request->user();
        $this->authorize('manageHighlights', $institution);
        $highlight = InstitutionHighlight::where('institution_user_id', $institution->id)->find($id);
        if (! $highlight) {
            return response()->json(['message' => 'Mise en avant introuvable.'], 404);
        }
        DB::transaction(fn () => $highlight->delete());

        return response()->json(['message' => 'Mise en avant supprimée.']);
    }

    public function reorderHighlights(Request $request): JsonResponse
    {
        $institution = $request->user();
        $this->authorize('manageHighlights', $institution);
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'integer', 'distinct'],
        ]);
        $currentIds = InstitutionHighlight::where('institution_user_id', $institution->id)->pluck('id')->sort()->values();
        $requestedIds = collect($data['ids'])->sort()->values();
        if ($currentIds->all() !== $requestedIds->all()) {
            throw ValidationException::withMessages(['ids' => ['La liste doit contenir exactement vos mises en avant.']]);
        }

        DB::transaction(function () use ($data): void {
            foreach ($data['ids'] as $index => $id) {
                InstitutionHighlight::whereKey($id)->update(['sort_order' => $index]);
            }
        });

        return response()->json(['message' => 'Ordre des mises en avant mis à jour.']);
    }

    private function assertHighlightEligible(User $institution, User $student): void
    {
        abort_unless(
            $student->role === 'student'
            && $student->student_profile_visibility === 'public'
            && trim(mb_strtolower((string) $student->institution)) !== ''
            && mb_strtolower(trim((string) $student->institution)) === mb_strtolower(trim((string) $institution->institution)),
            422,
            'Seuls les étudiants affiliés ayant rendu leur profil public peuvent être mis en avant.'
        );
    }

    private function profileData(User $user, bool $ownerView = false): array
    {
        $data = [
            'id' => $user->id,
            'name' => $user->name,
            'country' => $user->country,
            'headline' => $user->headline,
            'bio' => $user->bio,
            'website' => $user->website,
            'joined_at' => $user->created_at?->toIso8601String(),
        ];

        if ($user->role === 'student') {
            $data += [
                'role' => 'student',
                'institution' => $user->institution,
                'field_of_study' => $user->field_of_study,
                'level' => $user->level,
            ];
            if ($ownerView) {
                $data['profile_visibility'] = $user->student_profile_visibility;
            }
        } else {
            $data += [
                'role' => 'school',
                'institution' => $user->institution,
            ];
            if ($ownerView) {
                $data['profile_visibility'] = $user->institution_profile_visibility;
            }
        }

        return $data;
    }

    private function highlightData(InstitutionHighlight $highlight): array
    {
        return [
            'id' => $highlight->id,
            'student_id' => $highlight->student_user_id,
            'student_name' => $highlight->student?->name,
            'title' => $highlight->title,
            'message' => $highlight->message,
        ];
    }
}
