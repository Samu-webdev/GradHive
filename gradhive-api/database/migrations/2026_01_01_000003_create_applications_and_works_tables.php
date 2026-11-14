<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('position_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->decimal('gpa', 4, 2);
            $table->string('level', 20);
            $table->string('language_test', 10)->nullable();
            $table->decimal('language_score', 6, 1)->nullable();
            $table->boolean('language_waiver')->default(false);
            $table->text('motivation');
            $table->json('documents');                       // {"cv": "applications/...pdf", ...}
            $table->string('status', 20)->default('submitted'); // submitted | under_review | accepted | rejected
            $table->timestamps();
            $table->unique(['position_id', 'user_id']);       // une seule candidature par poste (RG11)
        });

        // Les projets sont présentés au réseau ; les établissements disposent d'un profil distinct.
        Schema::create('academic_works', function (Blueprint $table) {
            $table->id();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 250);
            $table->text('abstract');
            $table->string('theme', 100);
            $table->string('level', 20);
            $table->unsignedSmallInteger('year');
            $table->string('mention', 20)->nullable();
            $table->string('supervisor', 120)->nullable();
            $table->json('keywords');
            $table->string('institution', 150)->nullable();
            $table->string('file_path')->nullable();
            $table->string('file_name')->nullable();
            $table->unsignedInteger('views')->default(0);
            $table->timestamps();
            $table->index('year');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('academic_works');
        Schema::dropIfExists('applications');
    }
};
