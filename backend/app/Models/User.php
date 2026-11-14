<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLES = ['student', 'school', 'company', 'mentor', 'organization', 'admin'];

    protected $fillable = [
        'name', 'email', 'password', 'role', 'status', 'country', 'institution', 'field_of_study', 'level',
        'headline', 'bio', 'website',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return ['email_verified_at' => 'datetime', 'password' => 'hashed'];
    }

    /** Profil complet de l'utilisateur connecté. */
    public function toPublic(): array
    {
        return array_merge($this->toCard(), [
            'email' => $this->email, 'status' => $this->status, 'bio' => $this->bio, 'website' => $this->website,
        ]);
    }

    /** Carte de membre (annuaire, connexions). */
    public function toCard(): array
    {
        return [
            'id' => $this->id, 'name' => $this->name, 'role' => $this->role, 'country' => $this->country,
            'institution' => $this->institution, 'field_of_study' => $this->field_of_study, 'level' => $this->level,
            'headline' => $this->headline, 'joined_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
