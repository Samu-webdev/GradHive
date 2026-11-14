<?php

namespace Tests\Feature;

use App\Models\AcademicWork;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InstitutionPostAndReportApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_schools_manage_their_own_institutional_posts_and_feed_exposes_public_posts(): void
    {
        $school = $this->user('school', ['institution_profile_visibility' => 'public']);
        $otherSchool = $this->user('school');
        $student = $this->user('student');

        $this->actingAs($student)->postJson('/api/my/institution/posts', [
            'title' => 'Community update',
            'body' => 'An update for the academic community.',
        ])->assertForbidden();
        $created = $this->actingAs($school)->postJson('/api/my/institution/posts', [
            'title' => 'Community update',
            'body' => 'An update for the academic community.',
        ])->assertCreated();
        $postId = $created->json('data.id');
        $this->actingAs($otherSchool)->patchJson("/api/my/institution/posts/{$postId}", ['title' => 'Changed'])->assertNotFound();
        $this->actingAs($school)->getJson('/api/feed')->assertJsonFragment([
            'type' => 'institution_post',
            'title' => 'Community update',
        ]);
        $this->actingAs($school)->deleteJson("/api/my/institution/posts/{$postId}")->assertOk();
        $this->assertDatabaseMissing('institution_posts', ['id' => $postId]);
    }

    public function test_members_can_report_visible_content_and_admins_can_resolve_reports(): void
    {
        $reporter = $this->user('student');
        $author = $this->user('student');
        $admin = $this->user('admin');
        $work = AcademicWork::create([
            'author_id' => $author->id,
            'title' => 'Public research',
            'abstract' => 'A publicly visible research summary.',
            'theme' => 'Research',
            'level' => 'master',
            'year' => now()->year,
            'keywords' => [],
            'type' => 'project',
            'visibility' => 'public',
        ]);
        $privateWork = AcademicWork::create([
            'author_id' => $author->id,
            'title' => 'Private research',
            'abstract' => 'A private research summary.',
            'theme' => 'Research',
            'level' => 'master',
            'year' => now()->year,
            'keywords' => [],
            'type' => 'project',
            'visibility' => 'private',
        ]);

        $body = ['target_type' => 'work', 'target_id' => $work->id, 'reason' => 'inaccurate', 'details' => 'Please review this entry.'];
        $this->actingAs($reporter)->postJson('/api/reports', $body)->assertCreated()->assertJsonPath('data.status', 'open');
        $this->actingAs($reporter)->postJson('/api/reports', $body)->assertStatus(409);
        $this->actingAs($reporter)->postJson('/api/reports', [
            'target_type' => 'work', 'target_id' => $privateWork->id, 'reason' => 'spam',
        ])->assertNotFound();
        $this->actingAs($author)->postJson('/api/reports', [
            'target_type' => 'work', 'target_id' => $work->id, 'reason' => 'other',
        ])->assertUnprocessable();
        $this->actingAs($reporter)->getJson('/api/admin/reports')->assertForbidden();
        $this->actingAs($admin)->getJson('/api/admin/reports?status=open')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.target_label', $work->title);
        $reportId = $this->actingAs($admin)->getJson('/api/admin/reports')->json('data.0.id');
        $this->actingAs($admin)->patchJson("/api/admin/reports/{$reportId}", [
            'status' => 'reviewed', 'admin_note' => 'Reviewed by the moderation team.',
        ])->assertOk()->assertJsonPath('data.status', 'reviewed');
        $this->actingAs($admin)->getJson('/api/admin/dashboard')->assertJsonPath('data.open_reports', 0);
    }

    private function user(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'status' => 'active'], $overrides));
    }
}
