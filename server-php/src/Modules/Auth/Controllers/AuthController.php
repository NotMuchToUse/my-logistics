<?php

declare(strict_types=1);

namespace App\Modules\Auth\Controllers;

use App\Core\ApiException;
use App\Core\Request;
use App\Core\Response;
use App\Modules\Auth\Services\AuthService;
use App\Modules\Auth\Validators\ChangePasswordValidator;
use App\Modules\Auth\Validators\LoginValidator;
use App\Modules\Auth\Validators\RegisterValidator;

final class AuthController
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly RegisterValidator $registerValidator,
        private readonly LoginValidator $loginValidator,
        private readonly ChangePasswordValidator $changePasswordValidator,
    ) {
    }

    public function register(Request $request): Response
    {
        $idempotency = $request->attribute('public_idempotency');
        $idempotencyRecovery = $request->attribute('public_idempotency_recovery');
        if ($idempotency !== null && !is_array($idempotency)) {
            throw new ApiException('500_INTERNAL_ERROR', 'Ngữ cảnh Idempotency đăng ký không hợp lệ.');
        }

        if ($idempotencyRecovery !== null && !is_array($idempotencyRecovery)) {
            throw new ApiException('500_INTERNAL_ERROR', 'Ngữ cảnh khôi phục Idempotency không hợp lệ.');
        }

        $result = $this->authService->register(
            $this->registerValidator->validate($request->jsonBody()),
            $request->ipAddress(),
            $request->userAgent(),
            $idempotency,
            $idempotencyRecovery,
        );
        $recordId = $result['_idempotency_record_id'] ?? null;
        unset($result['_idempotency_record_id']);

        if (is_int($recordId)) {
            $request->setAttribute('idempotency_record_id', $recordId);
        }

        return Response::success($result, 'Đăng ký tài khoản thành công.', 201);
    }

    public function login(Request $request): Response
    {
        return Response::success(
            $this->authService->login(
                $this->loginValidator->validate($request->jsonBody()),
                (string) $request->clientType(),
                $request->ipAddress(),
                $request->userAgent(),
            ),
            'Đăng nhập thành công.',
        );
    }

    public function me(Request $request): Response
    {
        $auth = $request->attribute('auth');
        if (!is_array($auth) || !isset($auth['user_id'])) {
            throw new ApiException('401_UNAUTHORIZED', 'Cần đăng nhập để truy cập tài nguyên này.');
        }

        return Response::success($this->authService->me((int) $auth['user_id']), 'Lấy thông tin phiên thành công.');
    }

    public function changePassword(Request $request): Response
    {
        $auth = $request->attribute('auth');
        if (!is_array($auth) || !isset($auth['user_id'], $auth['token_id'])) {
            throw new ApiException('401_UNAUTHORIZED', 'Cần đăng nhập để đổi mật khẩu.');
        }

        $this->authService->changePassword(
            (int) $auth['user_id'],
            (int) $auth['token_id'],
            $this->changePasswordValidator->validate($request->jsonBody()),
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success(null, 'Đổi mật khẩu thành công.');
    }

    public function logout(Request $request): Response
    {
        $auth = $request->attribute('auth');
        if (!is_array($auth) || !isset($auth['token_id'])) {
            throw new ApiException('401_UNAUTHORIZED', 'Cần đăng nhập để đăng xuất.');
        }

        $this->authService->logout((int) $auth['token_id']);

        return Response::success(null, 'Đăng xuất thành công.');
    }
}
