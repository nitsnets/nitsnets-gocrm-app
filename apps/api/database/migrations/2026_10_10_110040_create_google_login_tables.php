<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('google_login_states', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('state_hash', 64)->unique();
            $table->string('nonce_hash', 64);
            $table->text('code_verifier');
            $table->string('client', 8);
            $table->string('client_challenge', 43);
            $table->timestamp('expires_at')->index();
            $table->timestamps();
        });
        Schema::create('google_identities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('subject', 255)->unique();
            $table->timestamps();
        });
        Schema::create('google_login_handoffs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('code_hash', 64)->unique();
            $table->string('client_challenge', 43);
            $table->timestamp('expires_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('google_login_handoffs');
        Schema::dropIfExists('google_identities');
        Schema::dropIfExists('google_login_states');
    }
};
