<?php

declare(strict_types=1);

namespace App\Modules\Auth\Validators;

use App\Core\ApiException;
use App\Modules\Auth\DTOs\LoginDto;

final class LoginValidator
{
    /**
     * @param array<string, mixed> $input
     */
    public function validate(array $input): LoginDto
    {
        $identifier = $input['identifier'] ?? $input['email'] ?? null;
        $password = $input['password'] ?? null;
        $errors = [];

        if (!is_string($identifier) || trim($identifier) === '' || mb_strlen(trim($identifier)) > 150) {
            $errors['identifier'][] = 'Email hoặc mã nhân viên là bắt buộc.';
        }

        if (!is_string($password) || $password === '') {
            $errors['password'][] = 'Mật khẩu là bắt buộc.';
        }

        if (
            isset($input['identifier'], $input['email'])
            && is_string($input['identifier'])
            && is_string($input['email'])
            && strcasecmp(trim($input['identifier']), trim($input['email'])) !== 0
        ) {
            $errors['identifier'][] = 'Chỉ được cung cấp một giá trị đăng nhập.';
        }

        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Thông tin đăng nhập không hợp lệ.', $errors);
        }

        return LoginDto::fromArray($input);
    }
}
