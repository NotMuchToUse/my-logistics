<?php

declare(strict_types=1);

namespace App\Modules\Auth\Validators;

use App\Core\ApiException;
use App\Modules\Auth\DTOs\RegisterCustomerDto;

final class RegisterValidator
{
    /**
     * @param array<string, mixed> $input
     */
    public function validate(array $input): RegisterCustomerDto
    {
        $errors = [];
        $fullName = $input['full_name'] ?? null;
        if (!is_string($fullName) || trim($fullName) === '' || mb_strlen(trim($fullName)) > 150) {
            $errors['full_name'][] = 'Họ và tên là bắt buộc và không vượt quá 150 ký tự.';
        }

        $email = $input['email'] ?? null;
        if (
            !is_string($email)
            || filter_var(trim($email), FILTER_VALIDATE_EMAIL) === false
            || mb_strlen(trim($email)) > 150
        ) {
            $errors['email'][] = 'Email bắt buộc và phải đúng định dạng.';
        }

        $phone = $input['phone'] ?? null;
        if (!is_string($phone) || !$this->isVietnamesePhone($phone)) {
            $errors['phone'][] = 'Số điện thoại Việt Nam không hợp lệ.';
        }

        $password = $input['password'] ?? null;
        if (!is_string($password) || !PasswordPolicy::isValid($password)) {
            $errors['password'][] = 'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.';
        }

        $customerType = $input['customer_type'] ?? 'individual';
        if (!is_string($customerType) || !in_array($customerType, ['individual', 'corporate_postpaid'], true)) {
            $errors['customer_type'][] = 'Loại khách hàng không hợp lệ.';
        }

        if ($customerType === 'corporate_postpaid') {
            $companyName = $input['company_name'] ?? null;
            if (!is_string($companyName) || trim($companyName) === '' || mb_strlen(trim($companyName)) > 200) {
                $errors['company_name'][] = 'Tên công ty là bắt buộc và không vượt quá 200 ký tự.';
            }

            $taxCode = $input['tax_code'] ?? null;
            if (!is_string($taxCode) || trim($taxCode) === '' || mb_strlen(trim($taxCode)) > 30) {
                $errors['tax_code'][] = 'Mã số thuế là bắt buộc và không vượt quá 30 ký tự.';
            }
        }

        if (($input['accepted_privacy_policy'] ?? null) !== true) {
            $errors['accepted_privacy_policy'][] = 'Bạn phải đồng ý với chính sách quyền riêng tư.';
        }

        $policyVersion = $input['policy_version'] ?? RegisterValidatorDefaults::PRIVACY_POLICY_VERSION;
        if (!is_string($policyVersion) || trim($policyVersion) === '' || mb_strlen(trim($policyVersion)) > 20) {
            $errors['policy_version'][] = 'Phiên bản chính sách không hợp lệ.';
        }

        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu đăng ký không hợp lệ.', $errors);
        }

        return RegisterCustomerDto::fromArray($input);
    }

    private function isVietnamesePhone(string $phone): bool
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '0084')) {
            $digits = '0' . substr($digits, 4);
        } elseif (str_starts_with($digits, '84')) {
            $digits = '0' . substr($digits, 2);
        }

        return preg_match('/^0[0-9]{9,10}$/', $digits) === 1;
    }
}
