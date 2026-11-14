<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('opportunities', function (Blueprint $table) {
            $table->string('country', 80)->nullable();
            $table->string('study_level', 20)->nullable();
            $table->text('requirements')->nullable();
            $table->json('skills')->nullable();
            $table->json('required_documents')->nullable();
            $table->text('application_method')->nullable();
        });

        Schema::create('institution_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('institution_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 200);
            $table->text('body');
            $table->timestamps();
            $table->index(['institution_user_id', 'created_at']);
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->string('target_type', 30);
            $table->unsignedBigInteger('target_id');
            $table->string('reason', 30);
            $table->text('details')->nullable();
            $table->string('status', 20)->default('open');
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('admin_note')->nullable();
            $table->timestamps();
            $table->unique(['reporter_id', 'target_type', 'target_id']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
        Schema::dropIfExists('institution_posts');
        Schema::table('opportunities', function (Blueprint $table) {
            $table->dropColumn(['country', 'study_level', 'requirements', 'skills', 'required_documents', 'application_method']);
        });
    }
};
