<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class ProfileApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_member_search_is_available_without_login_and_hides_private_profiles(): void
    {
        $publicStudent = User::factory()->create([
            'name' => 'Aminata Recherche',
            'role' => 'student',
            'status' => 'active',
            'student_profile_visibility' => 'public',
            'headline' => 'Researcher in data science',
        ]);
        User::factory()->create([
            'name' => 'Aminata Private',
            'role' => 'student',
            'status' => 'active',
            'student_profile_visibility' => 'private',
        ]);
        $publicMentor = User::factory()->create([
            'name' => 'Mentor Recherche',
            'role' => 'mentor',
            'status' => 'active',
        ]);

        $this->getJson('/api/search/members?q=recherche')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonFragment(['id' => $publicStudent->id, 'name' => 'Aminata Recherche'])
            ->assertJsonFragment(['id' => $publicMentor->id, 'name' => 'Mentor Recherche'])
            ->assertJsonMissing(['name' => 'Aminata Private'])
            ->assertJsonMissingPath('data.0.email');

        $this->getJson("/api/members/{$publicStudent->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $publicStudent->id)
            ->assertJsonMissingPath('data.email');
    }

    public function test_student_profile_is_private_until_the_student_publishes_it_and_never_exposes_email(): void
    {
        $student = User::factory()->create([
            'role' => 'student',
            'status' => 'active',
            'country' => 'Canada',
            'institution' => 'North University',
            'field_of_study' => 'Biology',
            'level' => 'master',
            'bio' => 'A profile bio.',
        ]);

        $this->getJson("/api/students/{$student->id}/profile")->assertNotFound();

        $this->actingAs($student)->patchJson('/api/my/profile', [
            'student_profile_visibility' => 'public',
            'headline' => 'Graduate researcher',
        ])->assertOk()->assertJsonPath('data.profile_visibility', 'public');

        $this->getJson("/api/students/{$student->id}/profile")
            ->assertOk()
            ->assertJsonPath('data.name', $student->name)
            ->assertJsonPath('data.institution', 'North University')
            ->assertJsonMissingPath('data.email')
            ->assertJsonMissingPath('data.status');
    }

    public function test_institution_can_only_highlight_an_affiliated_public_student(): void
    {
        $institution = User::factory()->create([
            'role' => 'school', 'status' => 'active', 'institution' => 'North University',
        ]);
        $student = User::factory()->create([
            'role' => 'student', 'status' => 'active', 'institution' => 'North University',
        ]);
        $otherInstitution = User::factory()->create([
            'role' => 'school', 'status' => 'active', 'institution' => 'South University',
        ]);

        $highlightData = [
            'student_id' => $student->id,
            'title' => 'Community contributor',
            'message' => 'A promotional message about student participation.',
        ];

        $this->actingAs($institution)->postJson('/api/my/institution/highlights', $highlightData)->assertUnprocessable();
        $this->actingAs($student)->patchJson('/api/my/profile', ['student_profile_visibility' => 'public'])->assertOk();

        $created = $this->actingAs($institution)->postJson('/api/my/institution/highlights', $highlightData)->assertCreated();
        $highlightId = $created->json('data.id');

        $this->getJson("/api/institutions/{$institution->id}/profile")
            ->assertOk()
            ->assertJsonPath('data.highlights.0.title', 'Community contributor')
            ->assertJsonMissingPath('data.email');

        $this->actingAs($otherInstitution)->deleteJson("/api/my/institution/highlights/{$highlightId}")->assertNotFound();
        $this->assertDatabaseHas('institution_highlights', [
            'institution_user_id' => $institution->id,
            'student_user_id' => $student->id,
        ]);
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $student->id,
            'data->event' => 'student_highlighted',
        ]);
    }

    public function test_profile_editing_is_limited_to_supported_roles_and_uses_the_authenticated_owner(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $other = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $company = User::factory()->create(['role' => 'company', 'status' => 'active']);

        $this->actingAs($other)->putJson('/api/my/profile', ['bio' => 'My own profile'])->assertOk();
        $this->assertDatabaseHas('users', ['id' => $other->id, 'bio' => 'My own profile']);
        $this->assertDatabaseMissing('users', ['id' => $student->id, 'bio' => 'My own profile']);
        $this->actingAs($company)->putJson('/api/my/profile', ['bio' => 'Not a supported profile'])->assertForbidden();
    }

    public function test_institution_can_search_eligible_students_and_reorder_its_highlights(): void
    {
        $institution = User::factory()->create([
            'role' => 'school', 'status' => 'active', 'institution' => 'North University',
        ]);
        $firstStudent = User::factory()->create([
            'role' => 'student', 'status' => 'active', 'institution' => 'North University',
            'name' => 'Test Étudiant',
            'student_profile_visibility' => 'public', 'field_of_study' => 'Biology',
        ]);
        $secondStudent = User::factory()->create([
            'role' => 'student', 'status' => 'active', 'institution' => 'North University',
            'student_profile_visibility' => 'public', 'field_of_study' => 'Computer Science',
        ]);
        User::factory()->create([
            'role' => 'student', 'status' => 'active', 'institution' => 'North University',
            'student_profile_visibility' => 'private',
        ]);
        User::factory()->create([
            'role' => 'student', 'status' => 'active', 'institution' => 'South University',
            'student_profile_visibility' => 'public',
        ]);

        $this->actingAs($institution)->getJson('/api/my/institution/eligible-students?q=biology')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $firstStudent->id)
            ->assertJsonMissingPath('data.0.email');

        $this->actingAs($institution)->getJson('/api/my/institution/eligible-students?q=Test%20%C3%89tudiant')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $firstStudent->id);

        $first = $this->postHighlight($institution, $firstStudent->id)->json('data.id');
        $second = $this->postHighlight($institution, $secondStudent->id)->json('data.id');

        $this->actingAs($institution)->patchJson('/api/my/institution/highlights/order', [
            'ids' => [$second, $first],
        ])->assertOk();

        $this->assertDatabaseHas('institution_highlights', ['id' => $second, 'sort_order' => 0]);
        $this->getJson("/api/institutions/{$institution->id}/profile")
            ->assertOk()->assertJsonPath('data.highlights.0.id', $second);
    }

    private function postHighlight(User $institution, int $studentId): TestResponse
    {
        return $this->actingAs($institution)->postJson('/api/my/institution/highlights', [
            'student_id' => $studentId,
            'title' => 'Student achievement',
            'message' => 'A student profile our institution is proud to showcase.',
        ])->assertCreated();
    }
}
