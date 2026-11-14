<?php

namespace Tests\Feature;

use App\Models\AcademicWork;
use App\Models\Connection;
use App\Models\InstitutionHighlight;
use App\Models\InstitutionPost;
use App\Models\Opportunity;
use App\Models\User;
use App\Notifications\GradHiveNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SocialApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_directory_honors_private_student_profiles_and_excludes_sensitive_fields(): void
    {
        $viewer = $this->user('student');
        $private = $this->user('student', ['email' => 'private@example.test']);
        $public = $this->user('student', [
            'student_profile_visibility' => 'public',
            'bio' => 'Public research bio',
            'website' => 'https://example.test',
        ]);

        $this->actingAs($viewer)->getJson('/api/members')->assertOk()
            ->assertJsonMissing(['id' => $private->id])
            ->assertJsonFragment(['id' => $public->id])
            ->assertJsonMissing(['email' => 'private@example.test']);
        $this->actingAs($viewer)->getJson("/api/members/{$private->id}")->assertNotFound();
        $this->actingAs($private)->getJson("/api/members/{$private->id}")->assertOk()
            ->assertJsonMissing(['email' => 'private@example.test']);
        $this->actingAs($viewer)->getJson("/api/members/{$public->id}")->assertOk()
            ->assertJsonPath('data.bio', 'Public research bio')
            ->assertJsonMissing(['email' => $public->email]);
    }

    public function test_directory_search_matches_accented_names(): void
    {
        $viewer = $this->user('student');
        $student = $this->user('student', [
            'name' => 'Test Étudiant',
            'student_profile_visibility' => 'public',
        ]);

        $this->actingAs($viewer)->getJson('/api/members?q=Test%20%C3%89tudiant')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $student->id);
    }

    public function test_directory_includes_connection_state_for_each_member(): void
    {
        $viewer = $this->user('school');
        $outgoing = $this->user('student', ['student_profile_visibility' => 'public']);
        $incoming = $this->user('student', ['student_profile_visibility' => 'public']);
        $connected = $this->user('mentor');

        Connection::create(['requester_id' => $viewer->id, 'recipient_id' => $outgoing->id, 'status' => 'pending']);
        Connection::create(['requester_id' => $incoming->id, 'recipient_id' => $viewer->id, 'status' => 'pending']);
        Connection::create(['requester_id' => $viewer->id, 'recipient_id' => $connected->id, 'status' => 'accepted']);

        $this->actingAs($viewer)->getJson('/api/members')->assertOk()
            ->assertJsonFragment(['id' => $viewer->id, 'connection' => 'self'])
            ->assertJsonFragment(['id' => $outgoing->id, 'connection' => 'pending_out'])
            ->assertJsonFragment(['id' => $incoming->id, 'connection' => 'pending_in'])
            ->assertJsonFragment(['id' => $connected->id, 'connection' => 'connected']);
    }

    public function test_connection_requests_are_authenticated_owned_and_return_expected_buckets(): void
    {
        $requester = $this->user('student');
        $recipient = $this->user('mentor');
        $thirdParty = $this->user('company');

        $this->postJson('/api/connections', ['user_id' => $recipient->id])->assertUnauthorized();
        $this->actingAs($requester)->postJson('/api/connections', ['user_id' => $requester->id])->assertUnprocessable();
        $created = $this->actingAs($requester)->postJson('/api/connections', ['user_id' => $recipient->id])
            ->assertCreated()->assertJsonPath('data.status', 'pending');
        $connectionId = $created->json('data.id');
        $this->actingAs($requester)->postJson('/api/connections', ['user_id' => $recipient->id])->assertStatus(409);
        $this->actingAs($requester)->patchJson("/api/connections/{$connectionId}/accept")->assertForbidden();
        $this->actingAs($thirdParty)->deleteJson("/api/connections/{$connectionId}")->assertForbidden();
        $this->actingAs($recipient)->getJson('/api/connections')->assertOk()
            ->assertJsonPath('incoming.0.id', $connectionId)->assertJsonPath('outgoing', []);
        $this->actingAs($recipient)->patchJson("/api/connections/{$connectionId}/accept")
            ->assertOk()->assertJsonPath('data.status', 'accepted');
        $this->actingAs($requester)->getJson('/api/connections')->assertOk()
            ->assertJsonPath('accepted.0.user.id', $recipient->id)->assertJsonPath('incoming', []);
        $this->actingAs($thirdParty)->patchJson("/api/connections/{$connectionId}/decline")->assertForbidden();
        $this->actingAs($requester)->deleteJson("/api/connections/{$connectionId}")->assertOk();
        $this->assertDatabaseMissing('connections', ['id' => $connectionId]);
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $recipient->id]);
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $requester->id]);
    }

    public function test_recipient_can_decline_pending_request_and_only_requester_can_cancel_it(): void
    {
        $requester = $this->user('student');
        $recipient = $this->user('school');
        $connection = Connection::create([
            'requester_id' => $requester->id, 'recipient_id' => $recipient->id, 'status' => 'pending',
        ]);

        $this->actingAs($recipient)->deleteJson("/api/connections/{$connection->id}")->assertForbidden();
        $this->actingAs($recipient)->patchJson("/api/connections/{$connection->id}/decline")
            ->assertOk()->assertJsonPath('data.status', 'declined');
        $this->actingAs($recipient)->deleteJson("/api/connections/{$connection->id}")->assertOk();
    }

    public function test_feed_combines_public_works_open_opportunities_and_opted_in_highlights_chronologically(): void
    {
        $viewer = $this->user('student');
        $author = $this->user('student', ['student_profile_visibility' => 'public']);
        $privateAuthor = $this->user('student');
        $school = $this->user('school', ['institution_profile_visibility' => 'public']);

        AcademicWork::create([
            'author_id' => $author->id, 'title' => 'Public study', 'abstract' => 'A public abstract.',
            'theme' => 'Biology', 'level' => 'master', 'year' => now()->year, 'keywords' => ['cells'],
            'visibility' => 'public', 'type' => 'project',
        ]);
        AcademicWork::create([
            'author_id' => $privateAuthor->id, 'title' => 'Hidden study', 'abstract' => 'Private abstract.',
            'theme' => 'Physics', 'level' => 'master', 'year' => now()->year, 'keywords' => [],
            'visibility' => 'private', 'type' => 'project',
        ]);
        Opportunity::create([
            'owner_id' => $school->id, 'type' => 'scholarship', 'title' => 'Open scholarship',
            'description' => 'Support for student researchers.',
        ]);
        InstitutionHighlight::create([
            'institution_user_id' => $school->id, 'student_user_id' => $author->id,
            'title' => 'Student highlight', 'message' => 'A promotional student feature.',
        ]);
        InstitutionPost::create([
            'institution_user_id' => $school->id,
            'title' => 'Institutional update',
            'body' => 'A public announcement for the academic community.',
        ]);

        $response = $this->actingAs($viewer)->getJson('/api/feed')->assertOk()
            ->assertJsonFragment(['type' => 'work'])
            ->assertJsonFragment(['type' => 'opportunity'])
            ->assertJsonFragment(['type' => 'highlight'])
            ->assertJsonFragment(['type' => 'institution_post'])
            ->assertJsonMissing(['title' => 'Hidden study']);
        $items = $response->json('data');
        $this->assertSame(
            collect($items)->sortByDesc(fn ($item) => strtotime($item['created_at']))->pluck('type')->all(),
            collect($items)->pluck('type')->all()
        );
    }

    public function test_notification_list_and_mark_read_routes_are_scoped_to_the_owner(): void
    {
        $user = $this->user('student');
        $other = $this->user('student');
        $user->notify(new GradHiveNotification(['event' => 'test_event']));
        $notification = $user->notifications()->firstOrFail();

        $this->actingAs($other)->patchJson("/api/notifications/{$notification->id}/read")->assertNotFound();
        $this->actingAs($user)->getJson('/api/notifications')->assertOk()
            ->assertJsonPath('meta.unread_count', 1);
        $this->actingAs($user)->patchJson("/api/notifications/{$notification->id}/read")->assertOk();
        $this->actingAs($user)->getJson('/api/notifications')->assertJsonPath('meta.unread_count', 0);
    }

    private function user(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'status' => 'active'], $overrides));
    }
}
