<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('universities', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('country', 80);
            $table->string('city', 80);
            $table->string('website')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_demo')->default(false);
            $table->timestamps();
        });

        Schema::create('positions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('university_id')->constrained()->cascadeOnDelete();
            $table->string('type', 2);                       // TA | RA
            $table->string('title', 200);
            $table->string('department', 150);
            $table->string('field', 100);
            $table->string('required_level', 20);            // licence | master | doctorat
            $table->decimal('min_average', 4, 2);            // sur 20
            $table->json('language_requirements')->nullable(); // {"TOEFL": 80, "IELTS": 6.5}
            $table->boolean('language_waiver_allowed')->default(false);
            $table->json('required_documents');              // ["cv", "transcripts", ...]
            $table->string('funding', 255);
            $table->unsignedSmallInteger('seats')->default(1);
            $table->date('deadline');
            $table->text('description')->nullable();
            $table->timestamps();
            $table->index(['type', 'deadline']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('positions');
        Schema::dropIfExists('universities');
    }
};
