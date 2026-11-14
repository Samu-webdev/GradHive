<?php

namespace Tests\Feature;

use App\Models\Opportunity;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_account_can_log_in_and_sample_opportunities_appear_in_the_public_feed(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->postJson('/api/login', [
            'email' => 'student@gradhive.test',
            'password' => 'password',
        ])->assertOk()
            ->assertJsonPath('user.email', 'student@gradhive.test')
            ->assertJsonStructure(['token', 'expires_at']);

        $this->assertSame(
            ['employment', 'internship', 'mobility_program', 'research_program', 'scholarship'],
            Opportunity::query()->orderBy('type')->pluck('type')->all(),
        );

        $this->getJson('/api/feed')->assertOk()
            ->assertJsonFragment([
                'type' => 'opportunity',
                'title' => 'Démo GradHive — Bourse internationale de master',
            ]);
    }
}
