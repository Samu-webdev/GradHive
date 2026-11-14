<?php

namespace Tests\Unit;

use App\Services\EligibilityService;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

class EligibilityServiceTest extends TestCase
{
    private array $position = [
        'required_level' => 'master', 'min_average' => 13,
        'language_requirements' => ['TCF' => 500, 'IELTS' => 6.5], 'language_waiver_allowed' => true,
        'required_documents' => ['cv', 'transcripts'], 'deadline' => '2027-01-31',
    ];
    private array $ok = ['gpa' => 14.5, 'level' => 'master', 'language_test' => 'TCF', 'language_score' => 520,
        'language_waiver' => false, 'documents' => ['cv', 'transcripts']];

    private function run_(array $override = [], string $today = '2026-10-14'): array
    {
        return (new EligibilityService())->check($this->position, array_merge($this->ok, $override), new DateTimeImmutable($today));
    }

    public function testEligibleWhenAllConditionsAreMet(): void
    {
        $this->assertTrue($this->run_()['eligible']);
    }

    public function testGpaBelowMinimumIsRejected(): void
    {
        $r = $this->run_(['gpa' => 12.9]);
        $this->assertFalse($r['eligible']);
        $this->assertFalse(array_values(array_filter($r['checks'], fn ($c) => $c['key'] === 'gpa'))[0]['ok']);
    }

    public function testLicenceCannotApplyToMasterPosition(): void
    {
        $this->assertFalse($this->run_(['level' => 'licence'])['eligible']);
        $this->assertTrue($this->run_(['level' => 'doctorat'])['eligible']);
    }

    public function testLanguageScoreMustReachTheTestMinimum(): void
    {
        $this->assertFalse($this->run_(['language_score' => 499])['eligible']);
        $this->assertTrue($this->run_(['language_test' => 'IELTS', 'language_score' => 6.5])['eligible']);
        $this->assertFalse($this->run_(['language_test' => 'TOEFL', 'language_score' => 100])['eligible']);
    }

    public function testLanguageWaiverOnlyWhenAllowed(): void
    {
        $this->assertTrue($this->run_(['language_test' => null, 'language_score' => null, 'language_waiver' => true])['eligible']);
        $position = $this->position; $position['language_waiver_allowed'] = false;
        $r = (new EligibilityService())->check($position, array_merge($this->ok, ['language_test' => null, 'language_score' => null, 'language_waiver' => true]), new DateTimeImmutable('2026-10-14'));
        $this->assertFalse($r['eligible']);
    }

    public function testMissingDocumentBlocksApplication(): void
    {
        $this->assertFalse($this->run_(['documents' => ['cv']])['eligible']);
    }

    public function testDeadlineIsInclusive(): void
    {
        $this->assertTrue($this->run_([], '2027-01-31')['eligible']);
        $this->assertFalse($this->run_([], '2027-02-01')['eligible']);
    }
}
