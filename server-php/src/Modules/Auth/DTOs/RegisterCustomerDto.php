<?php

declare(strict_types=1);

namespace App\Modules\Auth\DTOs;

use App\Modules\Auth\Validators\RegisterValidatorDefaults;

final class RegisterCustomerDto
{
    public function __construct(
        public readonly string $full_name,
        public readonly string $email,
        public readonly string $phone,
        public readonly string $password,
        public readonly string $customer_type,
        public readonly ?string $company_name,
        public readonly ?string $tax_code,
        public readonly string $policy_version,
    ) {
    }

    /**
     * @param array<string, mixed> $input
     */
    public static function fromArray(array $input): self
    {
        return new self(
            full_name: trim((string) $input['full_name']),
            email: strtolower(trim((string) $input['email'])),
            phone: trim((string) $input['phone']),
            password: (string) $input['password'],
            customer_type: (string) ($input['customer_type'] ?? 'individual'),
            company_name: isset($input['company_name']) ? trim((string) $input['company_name']) : null,
            tax_code: isset($input['tax_code']) ? trim((string) $input['tax_code']) : null,
            policy_version: isset($input['policy_version'])
                ? trim((string) $input['policy_version'])
                : RegisterValidatorDefaults::PRIVACY_POLICY_VERSION,
        );
    }
}
