<?php

namespace App\Models;

use App\Services\EligibilityService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Position extends Model
{
    protected $fillable = [
        'university_id', 'type', 'title', 'department', 'field', 'required_level', 'min_average',
        'language_requirements', 'language_waiver_allowed', 'required_documents', 'funding', 'seats',
        'deadline', 'description',
    ];

    protected $casts = [
        'min_average' => 'float',
        'language_requirements' => 'array',
        'language_waiver_allowed' => 'boolean',
        'required_documents' => 'array',
        'seats' => 'integer',
        'deadline' => 'date:Y-m-d',
    ];

    public function university(): BelongsTo { return $this->belongsTo(University::class); }
    public function applications(): HasMany { return $this->hasMany(Application::class); }

    /** Données du poste telles qu'attendues par EligibilityService. */
    public function toRules(): array
    {
        return [
            'required_level' => $this->required_level, 'min_average' => $this->min_average,
            'language_requirements' => $this->language_requirements ?? [],
            'language_waiver_allowed' => $this->language_waiver_allowed,
            'required_documents' => $this->required_documents ?? [],
            'deadline' => $this->deadline->format('Y-m-d'),
        ];
    }

    public function present(): array
    {
        return [
            'id' => $this->id, 'university_id' => $this->university_id, 'type' => $this->type, 'title' => $this->title,
            'department' => $this->department, 'field' => $this->field, 'required_level' => $this->required_level,
            'min_average' => $this->min_average, 'language_requirements' => (object) ($this->language_requirements ?? []),
            'language_waiver_allowed' => $this->language_waiver_allowed, 'required_documents' => $this->required_documents,
            'required_documents_labels' => array_map(
                fn ($k) => ['key' => $k, 'label' => EligibilityService::DOC_LABELS[$k]], $this->required_documents ?? []
            ),
            'funding' => $this->funding, 'seats' => $this->seats, 'deadline' => $this->deadline->format('Y-m-d'),
            'description' => $this->description, 'university' => $this->university,
        ];
    }
}
