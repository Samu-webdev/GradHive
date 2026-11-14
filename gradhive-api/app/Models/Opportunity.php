<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Opportunity extends Model
{
    public const TYPES = ['employment', 'internship', 'scholarship', 'ta', 'ra', 'mobility_program', 'research_program', 'other'];

    protected $fillable = [
        'owner_id', 'type', 'title', 'organization_name', 'location', 'country', 'remote', 'employment_type',
        'funding', 'deadline', 'description', 'status', 'study_level', 'requirements', 'skills',
        'required_documents', 'application_method',
    ];

    protected $casts = [
        'remote' => 'boolean',
        'deadline' => 'date:Y-m-d',
        'skills' => 'array',
        'required_documents' => 'array',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function applications(): HasMany
    {
        return $this->hasMany(OpportunityApplication::class);
    }

    public function present(bool $isFavorited = false): array
    {
        $owner = $this->owner;
        $ownerCard = $owner?->toCard();
        if ($owner && in_array($owner->role, ['school', 'company', 'organization'], true)
            && $owner->institution_profile_visibility !== 'public') {
            $ownerCard = ['id' => $owner->id, 'name' => $owner->name, 'role' => $owner->role];
        }

        return [
            'id' => $this->id,
            'owner_id' => $this->owner_id,
            'owner' => $ownerCard,
            'type' => $this->type,
            'title' => $this->title,
            'organization_name' => $this->organization_name,
            'location' => $this->location,
            'country' => $this->country,
            'remote' => $this->remote,
            'employment_type' => $this->employment_type,
            'funding' => $this->funding,
            'deadline' => $this->deadline?->format('Y-m-d'),
            'description' => $this->description,
            'study_level' => $this->study_level,
            'requirements' => $this->requirements,
            'skills' => $this->skills ?? [],
            'required_documents' => $this->required_documents ?? [],
            'application_method' => $this->application_method,
            'status' => $this->status,
            'is_favorited' => $isFavorited,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
