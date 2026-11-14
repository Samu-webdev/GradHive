<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('student_profile_visibility', 10)->default('private');
            $table->string('institution_profile_visibility', 10)->default('public');
        });

        Schema::table('academic_works', function (Blueprint $table) {
            $table->string('type', 30)->default('project');
            $table->string('visibility', 10)->default('public');
            $table->index(['visibility', 'type']);
        });

        Schema::create('institution_highlights', function (Blueprint $table) {
            $table->id();
            $table->foreignId('institution_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('student_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 120);
            $table->text('message');
            $table->timestamps();
            $table->unique(['institution_user_id', 'student_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('institution_highlights');

        Schema::table('academic_works', function (Blueprint $table) {
            $table->dropIndex(['visibility', 'type']);
            $table->dropColumn(['type', 'visibility']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['student_profile_visibility', 'institution_profile_visibility']);
        });
    }
};
