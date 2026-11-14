<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 20)->default('student')->after('password');   // student | school | company | mentor | organization | admin
            $table->string('status', 20)->default('active')->after('role');
            $table->string('country', 80)->nullable()->after('status');
            $table->string('institution', 150)->nullable()->after('country');
            $table->string('field_of_study', 120)->nullable()->after('institution');
            $table->string('level', 20)->nullable()->after('field_of_study');    // licence | master | doctorat
            $table->string('headline', 120)->nullable()->after('level');
            $table->text('bio')->nullable()->after('headline');
            $table->string('website')->nullable()->after('bio');
            $table->index(['role', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['role', 'status']);
            $table->dropColumn(['role', 'status', 'country', 'institution', 'field_of_study', 'level', 'headline', 'bio', 'website']);
        });
    }
};
