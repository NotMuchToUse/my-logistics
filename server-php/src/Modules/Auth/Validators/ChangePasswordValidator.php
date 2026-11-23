<?php

declare(strict_types=1);

namespace App\Modules\Auth\Validators;

use App\Core\ApiException;
use App\Modules\Auth\DTOs\ChangePasswordDto;

final class ChangePasswordValidator
{
    /**
     * @param array<string, mixed> $input
     */
    public function validate(array $input): ChangePasswordDto
    {
        $errors = [];
        foreach (['current_password', 'new_password', 'new_password_confirmation'] as $field) {
            if (!isset($input[$field]) || !is_string($input[$field]) || $input[$field] === '') {
                $errors[$field][] = 'Trường này là bắt buộc.';
            }
        }

        $newPassword = $input['new_password'] ?? null;
        if (is_string($newPassword) && !PasswordPolicy::isValid($newPassword)) {
            $errors['new_password'][] = 'Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.';
        }

        if (
            is_string($newPassword)
            && isset($input['new_password_confirmation'])
            && is_string($input['new_password_confirmation'])
            && !hash_equals($newPassword, $input['new_password_confirmation'])
        ) {
            $errors['new_password_confirmation'][] = 'Xác nhận mật khẩu mới không khớp.';
        }

        if (
            isset($input['current_password'], $input['new_password'])
            && is_string($input['current_password'])
            && is_string($input['new_password'])
            && hash_equals($input['current_password'], $input['new_password'])
        ) {
            $errors['new_password'][] = 'Mật khẩu mới phải khác mật khẩu hiện tại.';
        }

        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Thông tin đổi mật khẩu không hợp lệ.', $errors);
        }

        return ChangePasswordDto::fromArray($input);
    }
}
