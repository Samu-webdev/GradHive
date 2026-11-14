<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('opportunities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 30);
            $table->string('title', 200);
            $table->string('organization_name', 150)->nullable();
            $table->string('location', 150)->nullable();
            $table->boolean('remote')->default(false);
            $table->string('employment_type', 30)->nullable();
            $table->string('funding', 150)->nullable();
            $table->date('deadline')->nullable();
            $table->text('description');
            $table->string('status', 20)->default('open');
            $table->timestamps();
            $table->index(['status', 'type', 'created_at']);
            $table->index(['owner_id', 'status']);
        });

        Schema::create('opportunity_favorites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('opportunity_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['opportunity_id', 'user_id']);
        });

        Schema::create('opportunity_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('opportunity_id')->constrained();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->text('motivation')->nullable();
            $table->json('documents')->nullable();
            $table->string('status', 20)->default('submitted');
            $table->timestamps();
            $table->unique(['opportunity_id', 'user_id']);
            $table->index(['opportunity_id', 'status']);
        });

        Schema::create('opportunity_application_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained('opportunity_applications')->cascadeOnDelete();
            $table->foreignId('actor_id')->constrained('users')->cascadeOnDelete();
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20);
            $table->timestamps();
            $table->index(['application_id', 'created_at']);
        });

        Schema::create('connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('recipient_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 20)->default('pending');
            $table->timestamps();
            $table->unique(['requester_id', 'recipient_id']);
            $table->index(['recipient_id', 'status']);
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->json('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->index(['notifiable_type', 'notifiable_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('connections');
        Schema::dropIfExists('opportunity_application_status_history');
        Schema::dropIfExists('opportunity_applications');
        Schema::dropIfExists('opportunity_favorites');
        Schema::dropIfExists('opportunities');
    }
};
