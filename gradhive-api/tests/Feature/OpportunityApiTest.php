<?php

namespace Tests\Feature;

use App\Models\Opportunity;
use App\Models\OpportunityApplication;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OpportunityApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_publishers_own_opportunity_crud_and_public_search_hides_drafts(): void
    {
        $owner = $this->user('company');
        $otherPublisher = $this->user('school');
        $student = $this->user('student');

        $this->actingAs($student)->postJson('/api/opportunities', $this->payload())->assertForbidden();
        $this->actingAs($owner)->postJson('/api/opportunities', $this->payload(['status' => 'draft']))
            ->assertCreated()->assertJsonPath('data.status', 'draft');
        $draftId = Opportunity::firstOrFail()->id;
        $this->actingAs($otherPublisher)->getJson("/api/opportunities/{$draftId}")->assertNotFound();
        $this->actingAs($otherPublisher)->patchJson("/api/opportunities/{$draftId}", ['title' => 'Unauthorized'])->assertForbidden();
        $this->actingAs($owner)->patchJson("/api/opportunities/{$draftId}", ['status' => 'open'])->assertOk();
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $student->id,
            'data->event' => 'opportunity_published',
        ]);
        $this->getJson('/api/opportunities?type=internship&q=research&country=can&study_level=master')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $draftId)
            ->assertJsonPath('data.0.skills.0', 'Research');
        $this->actingAs($otherPublisher)->deleteJson("/api/opportunities/{$draftId}")->assertForbidden();
        $this->actingAs($owner)->deleteJson("/api/opportunities/{$draftId}")->assertOk();
    }

    public function test_students_can_favorite_and_apply_with_pdf_and_owner_can_review_status_history(): void
    {
        $owner = $this->user('organization');
        $student = $this->user('student');
        $otherStudent = $this->user('student');
        $otherPublisher = $this->user('company');
        $opportunity = Opportunity::create($this->payload(['owner_id' => $owner->id, 'required_documents' => ['cv', 'transcripts']]));

        $this->actingAs($owner)->postJson("/api/opportunities/{$opportunity->id}/favorite")->assertForbidden();
        $this->actingAs($student)->postJson("/api/opportunities/{$opportunity->id}/favorite")->assertOk();
        $this->getJson('/api/opportunities')->assertJsonPath('data.0.is_favorited', true);
        $this->actingAs($student)->getJson('/api/my/favorite-opportunities')->assertOk()->assertJsonPath('data.0.id', $opportunity->id);

        $this->actingAs($otherStudent)->postJson("/api/opportunities/{$opportunity->id}/applications", [
            'documents' => array_fill(0, 8, UploadedFile::fake()->createWithContent('cv.pdf', "%PDF-1.4\nPDF\n")),
        ])->assertUnprocessable()->assertJsonValidationErrors('documents');
        $this->actingAs($otherStudent)->postJson("/api/opportunities/{$opportunity->id}/applications", [
            'documents' => [UploadedFile::fake()->create('resume.txt', 10, 'text/plain')],
        ])->assertUnprocessable()->assertJsonValidationErrors('documents.0');
        $this->actingAs($otherStudent)->postJson("/api/opportunities/{$opportunity->id}/applications", [
            'documents' => [UploadedFile::fake()->create('oversized.pdf', 5121, 'application/pdf')],
        ])->assertUnprocessable()->assertJsonValidationErrors('documents.0');
        $this->actingAs($otherStudent)->postJson("/api/opportunities/{$opportunity->id}/applications", [
            'documents' => ['cv' => UploadedFile::fake()->createWithContent('cv.pdf', "%PDF-1.4\nPDF\n")],
        ])->assertUnprocessable()->assertJsonValidationErrors('documents.transcripts');
        $this->actingAs($student)->postJson("/api/opportunities/{$opportunity->id}/applications", [
            'motivation' => 'This research opportunity closely matches my academic interests.',
            'documents' => [
                'cv' => UploadedFile::fake()->createWithContent('original-cv.pdf', "%PDF-1.4\nPDF\n"),
                'transcripts' => UploadedFile::fake()->createWithContent('transcripts.pdf', "%PDF-1.4\nPDF\n"),
            ],
        ])->assertCreated()->assertJsonPath('data.status', 'submitted');
        $application = OpportunityApplication::firstOrFail();
        $storedPath = $application->documents[0]['path'];
        $this->assertStringNotContainsString('original-cv.pdf', $storedPath);
        Storage::disk('local')->assertExists($storedPath);
        $this->assertDatabaseHas('opportunity_application_status_history', [
            'application_id' => $application->id, 'from_status' => null, 'to_status' => 'submitted',
        ]);
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $owner->id,
        ]);

        $this->actingAs($otherStudent)->getJson("/api/my/opportunity-applications/{$application->id}")->assertNotFound();
        $this->actingAs($otherStudent)->get("/api/opportunity-applications/{$application->id}/documents/0")->assertForbidden();
        $this->actingAs($student)->get("/api/opportunity-applications/{$application->id}/documents/0")->assertOk();
        $this->actingAs($owner)->getJson("/api/my/opportunities/{$opportunity->id}/applications")
            ->assertOk()->assertJsonPath('data.0.applicant.id', $student->id);
        $this->actingAs($otherPublisher)->getJson("/api/my/opportunities/{$opportunity->id}/applications")->assertForbidden();

        $review = "/api/opportunities/{$opportunity->id}/applications/{$application->id}/status";
        $this->actingAs($owner)->patchJson($review, ['status' => 'accepted'])->assertUnprocessable();
        $this->actingAs($owner)->patchJson($review, ['status' => 'under_review'])->assertOk();
        $this->actingAs($owner)->patchJson($review, ['status' => 'shortlisted'])->assertOk();
        $this->actingAs($owner)->patchJson($review, ['status' => 'accepted'])->assertOk();
        $this->assertDatabaseCount('opportunity_application_status_history', 4);
        $this->actingAs($student)->getJson("/api/my/opportunity-applications/{$application->id}")
            ->assertOk()->assertJsonPath('data.history.3.to_status', 'accepted');
        $this->actingAs($student)->patchJson("/api/my/opportunity-applications/{$application->id}/withdraw")->assertUnprocessable();
        $this->actingAs($owner)->deleteJson("/api/opportunities/{$opportunity->id}")->assertStatus(409);
    }

    public function test_student_can_withdraw_and_only_publisher_roles_can_manage_opportunities(): void
    {
        $owner = $this->user('school');
        $student = $this->user('student');
        $opportunity = Opportunity::create($this->payload(['owner_id' => $owner->id]));
        $this->actingAs($student)->postJson("/api/opportunities/{$opportunity->id}/applications", [
            'motivation' => 'My studies and experience are a strong match for this opportunity.',
        ])->assertCreated();
        $application = OpportunityApplication::firstOrFail();
        $this->actingAs($student)->patchJson("/api/my/opportunity-applications/{$application->id}/withdraw")
            ->assertOk()->assertJsonPath('data.status', 'withdrawn');
        $this->actingAs($student)->patchJson("/api/my/opportunity-applications/{$application->id}/withdraw")->assertUnprocessable();
        $this->actingAs($owner)->patchJson(
            "/api/opportunities/{$opportunity->id}/applications/{$application->id}/status",
            ['status' => 'rejected']
        )->assertUnprocessable();
        $this->actingAs($owner)->patchJson("/api/opportunities/{$opportunity->id}", ['status' => 'closed'])->assertOk();
        $this->actingAs($student)->getJson("/api/opportunities/{$opportunity->id}")->assertNotFound();
        $this->actingAs($student)->postJson("/api/opportunities/{$opportunity->id}/applications")->assertNotFound();
    }

    public function test_publishing_open_opportunity_notifies_active_students_only(): void
    {
        $publisher = $this->user('company');
        $student = $this->user('student');
        $suspendedStudent = $this->user('student', ['status' => 'suspended']);
        $this->user('mentor');

        $this->actingAs($publisher)->postJson('/api/opportunities', $this->payload())
            ->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $student->id,
            'data->event' => 'opportunity_published',
        ]);
        $this->assertDatabaseMissing('notifications', ['notifiable_id' => $suspendedStudent->id]);
    }

    private function user(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'status' => 'active'], $overrides));
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'type' => 'internship',
            'title' => 'Research internship',
            'organization_name' => 'GradHive Labs',
            'location' => 'Toronto',
            'remote' => false,
            'employment_type' => 'full-time',
            'funding' => 'Paid',
            'deadline' => now()->addMonth()->toDateString(),
            'description' => 'A practical research role for graduate students.',
            'country' => 'Canada',
            'study_level' => 'master',
            'requirements' => 'Candidates should have graduate-level research experience.',
            'skills' => ['Research', 'Writing'],
            'required_documents' => [],
            'application_method' => 'Submit the application through GradHive.',
        ], $overrides);
    }
}
