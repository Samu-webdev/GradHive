<?php

namespace Tests\Feature;

use App\Models\AcademicWork;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AcademicWorkApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_work_creation_defaults_to_public_and_uses_a_generated_storage_filename(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);

        $response = $this->actingAs($student)->postJson('/api/works', $this->workPayload());

        $response->assertCreated()->assertJsonPath('data.type', 'project')->assertJsonPath('data.visibility', 'public');
        $work = AcademicWork::findOrFail($response->json('data.id'));
        $this->assertStringNotContainsString('original-thesis.pdf', $work->file_path);
        $this->assertStringEndsWith('.pdf', $work->file_path);
        Storage::disk('local')->assertExists($work->file_path);
        $this->getJson("/api/works/{$work->id}")->assertOk();
        $this->get("/api/works/{$work->id}/download")->assertOk();
    }

    public function test_private_work_is_hidden_from_others_and_only_its_owner_can_download_or_change_it(): void
    {
        $owner = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $other = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $create = $this->actingAs($owner)->postJson('/api/works', $this->workPayload(['visibility' => 'private']));
        $create->assertCreated();
        $workId = $create->json('data.id');
        $filePath = AcademicWork::findOrFail($workId)->file_path;

        $this->actingAs($other);
        $this->getJson("/api/works/{$workId}")->assertNotFound();
        $this->get("/api/works/{$workId}/download")->assertNotFound();
        $this->actingAs($other)->putJson("/api/works/{$workId}", ['title' => 'An unauthorized edit'])->assertForbidden();
        $this->actingAs($other)->deleteJson("/api/works/{$workId}")->assertForbidden();

        $this->actingAs($owner)->getJson("/api/works/{$workId}")->assertOk();
        $this->actingAs($owner)->get("/api/works/{$workId}/download")->assertOk();
        $ownerToken = $owner->createToken('test-owner')->plainTextToken;
        $this->withToken($ownerToken)->getJson("/api/works/{$workId}")->assertOk();
        $this->actingAs($owner)->putJson("/api/works/{$workId}", ['title' => 'Updated thesis'])->assertOk();
        $this->actingAs($owner)->deleteJson("/api/works/{$workId}")->assertOk();
        Storage::disk('local')->assertMissing($filePath);
    }

    public function test_bearer_token_owner_can_view_a_private_work_on_public_routes(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $token = $student->createToken('work-owner')->plainTextToken;
        $create = $this->withToken($token)->postJson('/api/works', $this->workPayload(['visibility' => 'private']));
        $create->assertCreated();

        $this->withToken($token)->getJson('/api/works?visibility=private')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);
        $this->withToken($token)->getJson('/api/works/'.$create->json('data.id'))->assertOk();
    }

    public function test_work_file_must_be_a_pdf_within_the_size_limit_and_student_role_is_required(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $company = User::factory()->create(['role' => 'company', 'status' => 'active']);

        $this->actingAs($company)->postJson('/api/works', $this->workPayload())->assertForbidden();
        $this->actingAs($student)->postJson('/api/works', $this->workPayload([
            'file' => UploadedFile::fake()->createWithContent('not-a-pdf.txt', 'not a pdf document'),
        ]))->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->actingAs($student)->postJson('/api/works', $this->workPayload([
            'file' => UploadedFile::fake()->create('oversized.pdf', 20481, 'application/pdf'),
        ]))->assertUnprocessable()->assertJsonValidationErrors('file');
    }

    public function test_public_work_filters_include_institution_and_field_of_study(): void
    {
        $northStudent = User::factory()->create([
            'role' => 'student', 'status' => 'active', 'institution' => 'North University',
            'field_of_study' => 'Biology',
        ]);
        $southStudent = User::factory()->create([
            'role' => 'student', 'status' => 'active', 'institution' => 'South University',
            'field_of_study' => 'Computer Science',
        ]);

        $north = $this->actingAs($northStudent)->postJson('/api/works', $this->workPayload())->assertCreated();
        $this->actingAs($southStudent)->postJson('/api/works', $this->workPayload([
            'title' => 'A second academic work',
        ]))->assertCreated();

        $this->getJson('/api/works?institution=North&field_of_study=biology&type=project')
            ->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $north->json('data.id'));
    }

    private function workPayload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'A useful thesis',
            'abstract' => str_repeat('Research details. ', 3),
            'theme' => 'Biology',
            'level' => 'master',
            'year' => now()->year,
            'keywords' => 'cells, research',
            'file' => UploadedFile::fake()->createWithContent('original-thesis.pdf', "%PDF-1.4\nAcademic work\n"),
        ], $overrides);
    }
}
