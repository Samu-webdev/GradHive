<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SanctumLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_expired_sanctum_token_is_rejected(): void
    {
        $user = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $token = $user->createToken('expired', ['*'], now()->subMinute())->plainTextToken;

        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_global_sanctum_expiration_covers_tokens_without_explicit_expires_at(): void
    {
        config(['sanctum.expiration' => 1]);
        $user = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $issued = $user->createToken('legacy', ['*']);
        DB::table('personal_access_tokens')->where('id', $issued->accessToken->id)->update([
            'created_at' => now()->subMinutes(2),
        ]);

        $this->withToken($issued->plainTextToken)
            ->getJson('/api/me')
            ->assertUnauthorized();
    }

    public function test_suspended_users_cannot_continue_using_previously_issued_tokens(): void
    {
        $user = User::factory()->create(['role' => 'student', 'status' => 'suspended']);
        $token = $user->createToken('active-before-suspension', ['*'])->plainTextToken;

        $this->withToken($token)->getJson('/api/me')->assertForbidden();
    }

    public function test_logout_revokes_the_current_personal_access_token(): void
    {
        $user = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $token = $user->createToken('logout-test')->plainTextToken;

        $this->withToken($token)->postJson('/api/logout')->assertOk();
        $this->assertDatabaseCount('personal_access_tokens', 0);
        Auth::forgetGuards();
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }
}
