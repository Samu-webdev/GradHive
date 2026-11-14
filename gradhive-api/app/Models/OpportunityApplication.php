<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OpportunityApplication extends Model
{
    protected $fillable = ['opportunity_id', 'user_id', 'motivation', 'documents', 'status'];

    protected $casts = ['documents' => 'array'];

    public function opportunity(): BelongsTo
    {
        return $this->belongsTo(Opportunity::class);
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(OpportunityApplicationStatusHistory::class, 'application_id');
    }

    public function present(bool $includeApplicant = false): array
    {
        $result = [
            'id' => $this->id,
            'opportunity_id' => $this->opportunity_id,
            'user_id' => $this->user_id,
            'motivation' => $this->motivation,
            'documents' => collect($this->documents ?? [])->values()->map(fn ($document, $index) => [
                'id' => $index,
                'name' => $document['name'],
                'type' => $document['type'] ?? 'other',
                'download_url' => "/api/opportunity-applications/{$this->id}/documents/{$index}",
            ])->values(),
            'status' => $this->status,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];

        if ($includeApplicant && $this->relationLoaded('applicant')) {
            $result['applicant'] = $this->applicant?->toCard();
        }

        return $result;
    }
}
