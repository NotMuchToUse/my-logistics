<?php

declare(strict_types=1);

namespace App\Modules\IncidentCompensation\Validators;

use App\Core\ApiException;

final class IncidentCompensationValidator
{
    private const INCIDENT_TYPES = [
        'damaged',
        'lost',
        'wet_contaminated',
        'delayed',
        'wrong_delivery',
        'other',
    ];

    private const INCIDENT_SEVERITIES = [
        'low',
        'medium',
        'high',
        'critical',
    ];

    private const INCIDENT_STATUSES = [
        'reported',
        'investigating',
        'resolved',
        'closed',
    ];

    private const APPROVAL_TYPES = [
        'cancel_delivered_shipment',
        'approve_return',
        'extra_redelivery',
    ];

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function validateCreateIncident(array $input): array
    {
        $errors = [];

        $shipmentIdentifier = $this->extractShipmentIdentifier($input, $errors);

        $incidentType = $input['incident_type'] ?? null;
        if (!is_string($incidentType) or !in_array($incidentType, self::INCIDENT_TYPES, true)) {
            $errors['incident_type'][] = 'Loại sự cố không hợp lệ.';
        }

        $severity = $input['severity'] ?? 'medium';
        if (!is_string($severity) or !in_array($severity, self::INCIDENT_SEVERITIES, true)) {
            $errors['severity'][] = 'Mức độ nghiêm trọng phải là low, medium, high hoặc critical.';
        }

        $description = $input['description'] ?? null;
        if (!is_string($description) or (trim($description) === '')) {
            $errors['description'][] = 'Mô tả chi tiết sự cố là bắt buộc.';
        } elseif (mb_strlen(trim($description), 'UTF-8') > 5000) {
            $errors['description'][] = 'Mô tả sự cố không được vượt quá 5000 ký tự.';
        }

        $evidenceUrls = $this->validateEvidenceUrls($input['evidence_urls'] ?? [], $errors);

        $responsibleUserId = null;
        if (array_key_exists('responsible_user_id', $input) and ($input['responsible_user_id'] !== null) and ($input['responsible_user_id'] !== '')) {
            $parsedUserId = filter_var($input['responsible_user_id'], FILTER_VALIDATE_INT);
            if (($parsedUserId === false) or ($parsedUserId < 1)) {
                $errors['responsible_user_id'][] = 'ID nhân sự chịu trách nhiệm phải là số nguyên dương.';
            } else {
                $responsibleUserId = $parsedUserId;
            }
        }

        $markShipmentIncident = true;
        if (array_key_exists('mark_shipment_incident', $input) and ($input['mark_shipment_incident'] !== null)) {
            $markShipmentIncident = filter_var($input['mark_shipment_incident'], FILTER_VALIDATE_BOOLEAN);
        }

        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu tạo báo cáo sự cố không hợp lệ.', $errors);
        }

        return [
            'shipment_identifier' => (string) $shipmentIdentifier,
            'incident_type' => (string) $incidentType,
            'severity' => (string) $severity,
            'description' => trim((string) $description),
            'evidence_urls' => $evidenceUrls,
            'responsible_user_id' => $responsibleUserId,
            'mark_shipment_incident' => $markShipmentIncident,
        ];
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function validateUpdateIncident(array $input): array
    {
        $errors = [];
        $updates = [];

        if (array_key_exists('status', $input)) {
            $status = $input['status'];
            if (!is_string($status) or !in_array($status, self::INCIDENT_STATUSES, true)) {
                $errors['status'][] = 'Trạng thái sự cố phải là reported, investigating, resolved hoặc closed.';
            } else {
                $updates['status'] = $status;
            }
        }

        if (array_key_exists('severity', $input)) {
            $severity = $input['severity'];
            if (!is_string($severity) or !in_array($severity, self::INCIDENT_SEVERITIES, true)) {
                $errors['severity'][] = 'Mức độ nghiêm trọng không hợp lệ.';
            } else {
                $updates['severity'] = $severity;
            }
        }

        if (array_key_exists('description', $input)) {
            $description = $input['description'];
            if (!is_string($description) or (trim($description) === '') or (mb_strlen(trim($description), 'UTF-8') > 5000)) {
                $errors['description'][] = 'Mô tả sự cố không được rỗng và tối đa 5000 ký tự.';
            } else {
                $updates['description'] = trim($description);
            }
        }

        if (array_key_exists('resolution_note', $input)) {
            $resolutionNote = $input['resolution_note'];
            if ($resolutionNote === null or ($resolutionNote === '')) {
                $updates['resolution_note'] = null;
            } elseif (!is_string($resolutionNote) or (mb_strlen(trim($resolutionNote), 'UTF-8') > 5000)) {
                $errors['resolution_note'][] = 'Ghi chú xử lý tối đa 5000 ký tự.';
            } else {
                $updates['resolution_note'] = trim($resolutionNote);
            }
        }

        if (array_key_exists('responsible_user_id', $input)) {
            $userId = $input['responsible_user_id'];
            if ($userId === null or ($userId === '')) {
                $updates['responsible_user_id'] = null;
            } else {
                $parsed = filter_var($userId, FILTER_VALIDATE_INT);
                if (($parsed === false) or ($parsed < 1)) {
                    $errors['responsible_user_id'][] = 'ID nhân sự chịu trách nhiệm phải là số nguyên dương.';
                } else {
                    $updates['responsible_user_id'] = $parsed;
                }
            }
        }

        if (array_key_exists('evidence_urls', $input)) {
            $updates['evidence_urls'] = $this->validateEvidenceUrls($input['evidence_urls'], $errors);
        }

        $restoreShipmentStatus = null;
        if (array_key_exists('restore_shipment_status', $input) and ($input['restore_shipment_status'] !== null) and ($input['restore_shipment_status'] !== '')) {
            $restoreStatus = $input['restore_shipment_status'];
            if (!is_string($restoreStatus) or !in_array($restoreStatus, ['in_warehouse', 'delivery_failed', 'pending_return'], true)) {
                $errors['restore_shipment_status'][] = 'Trạng thái khôi phục vận đơn phải là in_warehouse, delivery_failed hoặc pending_return.';
            } else {
                $restoreShipmentStatus = $restoreStatus;
            }
        }

        if (isset($updates['status']) and in_array($updates['status'], ['resolved', 'closed'], true)) {
            $note = $updates['resolution_note'] ?? null;
            if ($note === null or ($note === '')) {
                $errors['resolution_note'][] = 'Vui lòng nhập kết quả/ghi chú xử lý khi hoàn tất hoặc đóng sự cố.';
            }
        }

        if (($updates === []) and ($errors === [])) {
            $errors['payload'][] = 'Cần cung cấp ít nhất một trường dữ liệu để cập nhật sự cố.';
        }

        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu cập nhật sự cố không hợp lệ.', $errors);
        }

        return [
            'updates' => $updates,
            'restore_shipment_status' => $restoreShipmentStatus,
        ];
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function validateReturnDisposition(array $input): array
    {
        $errors = [];

        $action = $input['action'] ?? null;
        if (!is_string($action) or !in_array($action, ['redeliver', 'create_return_shipment'], true)) {
            $errors['action'][] = 'Hành động xử lý phải là redeliver (duyệt giao lại) hoặc create_return_shipment (tạo vận đơn chuyển hoàn).';
        }

        $version = filter_var($input['version'] ?? null, FILTER_VALIDATE_INT);
        if (($version === false) or ($version < 1)) {
            $errors['version'][] = 'Phiên bản (version) của vận đơn là bắt buộc và phải là số nguyên dương.';
        }

        $note = null;
        if (array_key_exists('note', $input) and ($input['note'] !== null) and ($input['note'] !== '')) {
            if (!is_string($input['note']) or (mb_strlen(trim($input['note']), 'UTF-8') > 500)) {
                $errors['note'][] = 'Ghi chú tối đa 500 ký tự.';
            } else {
                $note = trim($input['note']);
            }
        }

        $assignedDriverId = null;
        if (array_key_exists('assigned_driver_id', $input) and ($input['assigned_driver_id'] !== null) and ($input['assigned_driver_id'] !== '')) {
            $parsedDriver = filter_var($input['assigned_driver_id'], FILTER_VALIDATE_INT);
            if (($parsedDriver === false) or ($parsedDriver < 1)) {
                $errors['assigned_driver_id'][] = 'ID tài xế giao lại phải là số nguyên dương.';
            } else {
                $assignedDriverId = $parsedDriver;
            }
        }

        $chargeReturnFreight = false;
        if (array_key_exists('charge_return_freight', $input) and ($input['charge_return_freight'] !== null)) {
            $chargeReturnFreight = filter_var($input['charge_return_freight'], FILTER_VALIDATE_BOOLEAN);
        }

        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu điều phối chuyển hoàn không hợp lệ.', $errors);
        }

        return [
            'action' => (string) $action,
            'version' => (int) $version,
            'note' => $note,
            'assigned_driver_id' => $assignedDriverId,
            'charge_return_freight' => $chargeReturnFreight,
        ];
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function validateCreateApprovalRequest(array $input): array
    {
        $errors = [];

        $shipmentIdentifier = $this->extractShipmentIdentifier($input, $errors);

        $approvalType = $input['approval_type'] ?? 'cancel_delivered_shipment';
        if (!is_string($approvalType) or !in_array($approvalType, self::APPROVAL_TYPES, true)) {
            $errors['approval_type'][] = 'Loại yêu cầu phê duyệt phải là cancel_delivered_shipment, approve_return hoặc extra_redelivery.';
        }

        $reason = $input['reason'] ?? null;
        if (!is_string($reason) or (trim($reason) === '')) {
            $errors['reason'][] = 'Lý do gửi yêu cầu phê duyệt là bắt buộc.';
        } elseif (mb_strlen(trim($reason), 'UTF-8') > 500) {
            $errors['reason'][] = 'Lý do yêu cầu không được vượt quá 500 ký tự.';
        }

        $evidenceUrls = $this->validateEvidenceUrls($input['evidence_urls'] ?? [], $errors);

        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu tạo yêu cầu phê duyệt không hợp lệ.', $errors);
        }

        return [
            'shipment_identifier' => (string) $shipmentIdentifier,
            'approval_type' => (string) $approvalType,
            'reason' => trim((string) $reason),
            'evidence_urls' => $evidenceUrls,
        ];
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function validateReviewApprovalRequest(array $input): array
    {
        $errors = [];

        $decision = $input['decision'] ?? $input['status'] ?? null;
        if (!is_string($decision) or !in_array($decision, ['approved', 'rejected'], true)) {
            $errors['decision'][] = 'Quyết định phê duyệt phải là approved hoặc rejected.';
        }

        $version = filter_var($input['version'] ?? null, FILTER_VALIDATE_INT);
        if (($version === false) or ($version < 1)) {
            $errors['version'][] = 'Phiên bản (version) của yêu cầu phê duyệt là bắt buộc và phải là số nguyên dương.';
        }

        $reviewNote = null;
        if (array_key_exists('review_note', $input) and ($input['review_note'] !== null) and ($input['review_note'] !== '')) {
            if (!is_string($input['review_note']) or (mb_strlen(trim($input['review_note']), 'UTF-8') > 500)) {
                $errors['review_note'][] = 'Ghi chú phê duyệt tối đa 500 ký tự.';
            } else {
                $reviewNote = trim($input['review_note']);
            }
        }

        if (($decision === 'rejected') and ($reviewNote === null)) {
            $errors['review_note'][] = 'Vui lòng nhập lý do từ chối yêu cầu phê duyệt.';
        }

        $revertToStatus = $input['revert_to_status'] ?? 'delivery_failed';
        if (!is_string($revertToStatus) or !in_array($revertToStatus, ['delivery_failed', 'in_warehouse'], true)) {
            $errors['revert_to_status'][] = 'Trạng thái hoàn tác vận đơn phải là delivery_failed hoặc in_warehouse.';
        }

        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu xét duyệt yêu cầu không hợp lệ.', $errors);
        }

        return [
            'decision' => (string) $decision,
            'version' => (int) $version,
            'review_note' => $reviewNote,
            'revert_to_status' => (string) $revertToStatus,
        ];
    }

    /**
     * @param array<string, mixed> $input
     * @param array<string, list<string>> $errors
     */
    private function extractShipmentIdentifier(array $input, array &$errors): ?string
    {
        $raw = $input['shipment_public_id'] ?? $input['tracking_code'] ?? $input['shipment_identifier'] ?? null;
        if (!is_string($raw) or (trim($raw) === '') or (mb_strlen(trim($raw), 'UTF-8') > 64)) {
            $errors['shipment_public_id'][] = 'Vui lòng cung cấp shipment_public_id hoặc tracking_code hợp lệ.';
            return null;
        }

        return trim($raw);
    }

    /**
     * @param array<string, list<string>> $errors
     * @return list<string>
     */
    private function validateEvidenceUrls(mixed $value, array &$errors): array
    {
        if (($value === null) or ($value === '')) {
            return [];
        }
        if (!is_array($value) or !array_is_list($value)) {
            $errors['evidence_urls'][] = 'Danh sách bằng chứng phải là mảng chuỗi URL.';
            return [];
        }
        if (count($value) > 10) {
            $errors['evidence_urls'][] = 'Tối đa 10 tệp/ảnh bằng chứng.';
            return [];
        }

        $urls = [];
        foreach ($value as $idx => $item) {
            if (!is_string($item) or (trim($item) === '') or (mb_strlen(trim($item), 'UTF-8') > 500)) {
                $errors['evidence_urls.' . $idx][] = 'Đường dẫn bằng chứng phải là chuỗi không rỗng, tối đa 500 ký tự.';
                continue;
            }
            $urls[] = trim($item);
        }

        return $urls;
    }
}