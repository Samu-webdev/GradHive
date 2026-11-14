<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_admins_can_access_dashboard_and_account_management(): void
    {
        $admin = $this->user('admin');
        $student = $this->user('student');
        $target = $this->user('company', ['name' => 'Searchable Company']);

        $this->getJson('/api/admin/dashboard')->assertUnauthorized();
        $this->actingAs($student)->getJson('/api/admin/dashboard')->assertForbidden();
        $this->actingAs($student)->getJson('/api/admin/users')->assertForbidden();
        $this->actingAs($student)->patchJson("/api/admin/users/{$target->id}/suspend")->assertForbidden();

        $this->actingAs($admin)->getJson('/api/admin/dashboard')->assertOk()
            ->assertJsonPath('data.accounts.total', 3)
            ->assertJsonPath('data.accounts.by_role.company', 1)
            ->assertJsonPath('data.academic_works', 0)
            ->assertJsonPath('data.open_reports', 0);
        $this->actingAs($admin)->getJson('/api/admin/users?q=searchable&role=company')
            ->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.email', $target->email);
        $this->actingAs($admin)->patchJson("/api/admin/users/{$admin->id}/suspend")->assertUnprocessable();
        $this->actingAs($admin)->patchJson("/api/admin/users/{$target->id}/suspend")
            ->assertOk()->assertJsonPath('data.status', 'suspended');
        $target->refresh();
        $this->actingAs($target)->getJson('/api/me')->assertForbidden();
        $this->actingAs($admin)->patchJson("/api/admin/users/{$target->id}/reactivate")
            ->assertOk()->assertJsonPath('data.status', 'active');
        $target->refresh();
        $this->actingAs($target)->getJson('/api/me')->assertOk();
    }

    private function user(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => $role, 'status' => 'active'], $overrides));
    }
}
