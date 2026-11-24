<?php

declare(strict_types=1);

namespace App\Modules\Shipment\Repositories;

use App\Core\ApiException;
use PDO;

final class TrackingRangeRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function allocateNext(int $branchId): string
    {
        if (!$this->pdo->inTransaction()) {
            throw new ApiException('500_INTERNAL_ERROR', 'Cấp mã vận đơn cần được thực hiện trong transaction.');
        }

        $statement = $this->pdo->prepare(
            "SELECT id, prefix, current_number, range_end
             FROM tracking_number_ranges
             WHERE branch_id = :branch_id
               AND status = 'active'
             ORDER BY id ASC
             LIMIT 1
             FOR UPDATE",
        );
        $statement->execute([':branch_id' => $branchId]);
        $range = $statement->fetch(PDO::FETCH_ASSOC);

        if ($range === false) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Chi nhánh chưa được cấp dải mã vận đơn đang hoạt động.',
                ['tracking_code' => ['Không tìm thấy dải mã phù hợp.']],
            );
        }

        $currentNumber = (int) $range['current_number'];
        $rangeEnd = (int) $range['range_end'];
        if ($currentNumber >= $rangeEnd) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Dải mã vận đơn của chi nhánh đã được sử dụng hết.',
                ['tracking_code' => ['Không còn mã vận đơn khả dụng.']],
            );
        }

        $nextNumber = $currentNumber + 1;
        $updateStatement = $this->pdo->prepare(
            'UPDATE tracking_number_ranges
             SET current_number = :current_number,
                 status = :status,
                 updated_at = NOW()
             WHERE id = :id AND current_number = :previous_number',
        );
        $updateStatement->execute([
            ':current_number' => $nextNumber,
            ':status' => $nextNumber >= $rangeEnd ? 'exhausted' : 'active',
            ':id' => (int) $range['id'],
            ':previous_number' => $currentNumber,
        ]);

        if ($updateStatement->rowCount() !== 1) {
            throw new ApiException('409_VERSION_CONFLICT', 'Dải mã vận đơn vừa được cập nhật, vui lòng thử lại.');
        }

        return (string) $range['prefix'] . str_pad((string) $nextNumber, 8, '0', STR_PAD_LEFT);
    }
}
