<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('oauth_states', function (Blueprint $table) {
            $table->string('client')->default('web');
        });
    }

    public function down(): void
    {
        Schema::table('oauth_states', function (Blueprint $table) {
            $table->dropColumn('client');
        });
    }
};
