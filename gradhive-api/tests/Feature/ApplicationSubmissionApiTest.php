<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Position;
use App\Models\University;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class ApplicationSubmissionApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_application_inputs_are_validated_before_any_file_is_stored(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $position = $this->position();

        $response = $this->actingAs($student)->postJson("/api/positions/{$position->id}/applications", [
            'gpa' => 'not-a-number',
            'level' => 'master',
            'motivation' => str_repeat('A sufficiently long motivation statement. ', 2),
            'documents' => ['cv' => UploadedFile::fake()->createWithContent('cv.pdf', "%PDF-1.4\nCV\n")],
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('gpa');
        $this->assertDatabaseCount('applications', 0);
        $this->assertSame([], Storage::disk('local')->allFiles('applications'));
    }

    public function test_valid_application_is_saved_with_generated_document_storage_path(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $position = $this->position();

        $response = $this->actingAs($student)->postJson("/api/positions/{$position->id}/applications", [
            'gpa' => 16.25,
            'level' => 'master',
            'language_waiver' => false,
            'motivation' => str_repeat('I am applying because this research opportunity fits my studies. ', 2),
            'documents' => ['cv' => UploadedFile::fake()->createWithContent('original-cv.pdf', "%PDF-1.4\nCV\n")],
        ]);

        $response->assertCreated();
        $application = Application::findOrFail($response->json('data.id'));
        $path = $application->documents['cv'];
        $this->assertStringNotContainsString('original-cv.pdf', $path);
        Storage::disk('local')->assertExists($path);
    }

    public function test_uploaded_application_files_are_removed_if_database_persistence_fails(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $position = $this->position();
        Application::creating(fn () => throw new RuntimeException('Simulated persistence failure.'));

        try {
            $this->withoutExceptionHandling()->actingAs($student)->postJson(
                "/api/positions/{$position->id}/applications",
                [
                    'gpa' => 16,
                    'level' => 'master',
                    'motivation' => str_repeat('I am applying because this research opportunity fits my studies. ', 2),
                    'documents' => ['cv' => UploadedFile::fake()->createWithContent('cv.pdf', "%PDF-1.4\nCV\n")],
                ]
            );
            $this->fail('Expected the simulated persistence error.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Simulated persistence failure.', $exception->getMessage());
        } finally {
            Application::flushEventListeners();
        }

        $this->assertSame([], Storage::disk('local')->allFiles('applications'));
    }

    private function position(): Position
    {
        $university = University::create([
            'name' => 'North University',
            'country' => 'Canada',
            'city' => 'Toronto',
        ]);

        return Position::create([
            'university_id' => $university->id,
            'type' => 'RA',
            'title' => 'Research assistant',
            'department' => 'Biology',
            'field' => 'Biology',
            'required_level' => 'master',
            'min_average' => 12,
            'language_requirements' => [],
            'language_waiver_allowed' => false,
            'required_documents' => ['cv'],
            'funding' => 'Funded',
            'seats' => 1,
            'deadline' => now()->addMonth()->toDateString(),
        ]);
    }
}
