import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { USE_MOCK } from "@/core/api/axiosClient";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useBranchScopeStore } from "@/core/stores/useBranchScopeStore";
import {
  fetchShipmentExceptionsApi,
  getShipmentExceptionCapabilities,
  getShipmentInheritedInfo,
} from "@/features/shipment-exceptions/api/shipment-exceptions.api";
import {
  forwardShipmentSchema,
  type ForwardShipmentSchemaInput,
  type ForwardShipmentSchemaOutput,
} from "@/features/shipment-exceptions/schemas/shipment-exceptions.schema";
import type {
  ApiPaginationResponse,
  ApiErrorResponse,
  PaginationMeta,
} from "@/types/api.types";
import type {
  ForwardShipmentFormInputValues,
  ShipmentExceptionCapabilities,
  ShipmentExceptionDataSource,
  ShipmentExceptionListItem,
  ShipmentExceptionsTab,
  ShipmentInheritedInfo,
} from "@/features/shipment-exceptions/types/shipment-exceptions.types";

type ListStatus = "idle" | "loading" | "refreshing" | "success" | "error";
type InheritedInfoStatus = "idle" | "loading" | "ready" | "unavailable" | "error";
type ShipmentErrorKind = "backend-unavailable" | "fixture" | "request";

interface ShipmentListState {
  requestKey: string;
  sessionContext: object;
  status: ListStatus;
  data: ShipmentExceptionListItem[];
  pagination: PaginationMeta;
  error: unknown;
  hasLoaded: boolean;
}

interface ShipmentDialogState {
  kind: "return" | "forward";
  publicId: string;
  requestKey: string;
  sessionKey: string;
  sessionContext: object;
}

interface InheritedInfoState {
  publicId: string;
  dialogContextKey: string;
  sessionContext: object;
  status: InheritedInfoStatus;
  data: ShipmentInheritedInfo | null;
  error: unknown;
}

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  per_page: 20,
  total: 0,
  total_pages: 0,
};

const EMPTY_CAPABILITIES: ShipmentExceptionCapabilities = {
  canViewList: false,
  canOpenReturnModal: false,
  canCreateReturnShipment: false,
  canOpenForwardModal: false,
  canCreateForwardShipment: false,
  canApproveRedelivery: false,
};

const FORWARD_MUTATION_BLOCKED_REASON =
  "Không thể tạo vận đơn chuyển tiếp: Backend, quyền thao tác và danh mục địa giới chưa sẵn sàng.";

const CATALOG_UNAVAILABLE_REASON =
  "Danh mục tỉnh/thành, quận/huyện, phường/xã và chi nhánh chưa khả dụng.";

function createEmptyForwardFormValues(): ForwardShipmentFormInputValues {
  return {
    recipient_name: "",
    recipient_phone: "",
    recipient_address: "",
    recipient_province_id: "",
    recipient_district_id: "",
    recipient_ward_id: "",
    destination_branch_id: "",
  };
}

function createEmptyPagination(page: number, perPage: number): PaginationMeta {
  return {
    ...EMPTY_PAGINATION,
    page,
    per_page: perPage,
  };
}

function isErrorDetails(value: unknown): value is Record<string, string[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (messages) =>
      Array.isArray(messages) &&
      messages.every((message) => typeof message === "string"),
  );
}

function readApiError(error: unknown): ApiErrorResponse["error"] | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("success" in error) ||
    error.success !== false ||
    !("error" in error)
  ) {
    return null;
  }

  const apiError = error.error;

  if (
    typeof apiError !== "object" ||
    apiError === null ||
    !("code" in apiError) ||
    typeof apiError.code !== "string" ||
    !isApiErrorCode(apiError.code) ||
    !("message" in apiError) ||
    typeof apiError.message !== "string"
  ) {
    return null;
  }

  return {
    code: apiError.code,
    message: apiError.message,
    ...("details" in apiError && isErrorDetails(apiError.details)
      ? { details: apiError.details }
      : {}),
    ...("trace_id" in apiError && typeof apiError.trace_id === "string"
      ? { trace_id: apiError.trace_id }
      : {}),
  };
}

function isApiErrorCode(value: string): value is ApiErrorResponse["error"]["code"] {
  return [
    "400_BAD_REQUEST",
    "401_UNAUTHORIZED",
    "403_FORBIDDEN",
    "403_BRANCH_SCOPE",
    "404_NOT_FOUND",
    "409_VERSION_CONFLICT",
    "409_IDEMPOTENCY_DUPLICATE",
    "422_VALIDATION_ERROR",
    "429_TOO_MANY_REQUESTS",
    "500_INTERNAL_ERROR",
  ].some((code) => code === value);
}

function getErrorKind(error: unknown): ShipmentErrorKind {
  const apiError = readApiError(error);

  if (
    apiError?.code === "500_INTERNAL_ERROR" &&
    apiError.message.includes("Backend Shipment chưa khả dụng")
  ) {
    return "backend-unavailable";
  }

  if (error instanceof Error && error.name === "ZodError") {
    return "fixture";
  }

  return "request";
}

function getErrorMessage(error: unknown): string {
  const apiError = readApiError(error);

  if (apiError) {
    return apiError.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Không thể tải danh sách vận đơn.";
}

export function useShipmentExceptions() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasToken = useAuthStore((state) => state.token !== null);
  const sessionUser = useAuthStore((state) => state.user);
  const userPublicId = sessionUser?.public_id ?? null;
  const roles = useAuthStore((state) => state.roles);
  const permissions = useAuthStore((state) => state.permissions);
  const hasShipmentReadPermission = useAuthStore((state) =>
    state.hasPermission("shipment.read"),
  );
  const activeBranchId = useBranchScopeStore((state) => state.activeBranchId);
  const activeWarehouseId = useBranchScopeStore(
    (state) => state.activeWarehouseId,
  );

  const [activeTab, setActiveTabState] =
    useState<ShipmentExceptionsTab>("exceptions");
  const [searchTerm, setSearchTermState] = useState("");
  const [page, setPageState] = useState(1);
  const [perPage, setPerPageState] = useState(EMPTY_PAGINATION.per_page);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [listState, setListState] = useState<ShipmentListState>({
    requestKey: "",
    sessionContext: {},
    status: "idle",
    data: [],
    pagination: EMPTY_PAGINATION,
    error: null,
    hasLoaded: false,
  });
  const [dialog, setDialog] = useState<ShipmentDialogState | null>(null);
  const [inheritedInfoState, setInheritedInfoState] =
    useState<InheritedInfoState | null>(null);
  const [forwardSubmitBlockedForSession, setForwardSubmitBlockedForSession] =
    useState<object | null>(null);
  const requestSequence = useRef(0);
  const inheritedRequestSequence = useRef(0);

  const sessionActive =
    isAuthenticated && hasToken && userPublicId !== null;
  const sessionKey = JSON.stringify([
    sessionActive,
    userPublicId,
    [...roles].sort(),
    [...permissions].sort(),
    activeBranchId,
    activeWarehouseId,
  ]);
  const sessionContext = useMemo(
    () => ({ key: sessionKey, user: sessionUser }),
    [sessionKey, sessionUser],
  );
  const normalizedSearch = searchTerm.trim();
  const query = useMemo(
    () => ({
      tab: activeTab,
      page,
      per_page: perPage,
      tracking_code: normalizedSearch,
    }),
    [activeTab, normalizedSearch, page, perPage],
  );
  const requestKey = JSON.stringify([sessionKey, query]);
  const dialogContextKey = JSON.stringify([
    sessionKey,
    activeTab,
    normalizedSearch,
    page,
    perPage,
  ]);

  const forwardForm = useForm<
    ForwardShipmentSchemaInput,
    unknown,
    ForwardShipmentSchemaOutput
  >({
    resolver: zodResolver(forwardShipmentSchema),
    defaultValues: createEmptyForwardFormValues(),
    mode: "onSubmit",
  });

  const visibleListState: ShipmentListState =
    listState.requestKey === requestKey &&
    listState.sessionContext === sessionContext
      ? listState
      : {
          requestKey,
          sessionContext,
          status: sessionActive ? "loading" : "idle",
          data: [],
          pagination: createEmptyPagination(page, perPage),
          error: null,
          hasLoaded: false,
        };
  const shipments = visibleListState.data;
  const pagination = visibleListState.pagination;
  const capabilities = useMemo(
    () =>
      sessionActive
        ? getShipmentExceptionCapabilities(activeTab)
        : EMPTY_CAPABILITIES,
    [activeTab, sessionActive],
  );
  const effectiveDialog =
    dialog?.requestKey === dialogContextKey &&
    dialog.sessionKey === sessionKey &&
    dialog.sessionContext === sessionContext
      ? dialog
      : null;
  const selectedShipment =
    shipments.find(
      (shipment) => shipment.public_id === effectiveDialog?.publicId,
    ) ?? null;
  const inheritedInfo =
    inheritedInfoState !== null &&
    effectiveDialog !== null &&
    inheritedInfoState.publicId === effectiveDialog.publicId &&
    inheritedInfoState.dialogContextKey === dialogContextKey &&
    inheritedInfoState.sessionContext === sessionContext
      ? inheritedInfoState
      : null;

  const forwardFormState = forwardForm.formState;
  const forwardSubmitBlockedReason =
    forwardSubmitBlockedForSession === sessionContext
      ? FORWARD_MUTATION_BLOCKED_REASON
      : null;

  const closeDialog = useCallback(() => {
    inheritedRequestSequence.current += 1;
    setDialog(null);
    setInheritedInfoState(null);
    setForwardSubmitBlockedForSession(null);
    forwardForm.reset(createEmptyForwardFormValues());
  }, [forwardForm]);

  useEffect(() => {
    inheritedRequestSequence.current += 1;
    forwardForm.reset(createEmptyForwardFormValues());
  }, [forwardForm, sessionContext]);

  useEffect(() => {
    const currentRequest = ++requestSequence.current;
    let active = true;

    if (!sessionActive) {
      return () => {
        active = false;
        if (requestSequence.current === currentRequest) {
          requestSequence.current += 1;
        }
      };
    }

    setListState((current) => {
      const sameRequest =
        current.requestKey === requestKey &&
        current.sessionContext === sessionContext;

      return {
        requestKey,
        sessionContext,
        status: sameRequest && current.hasLoaded ? "refreshing" : "loading",
        data: sameRequest ? current.data : [],
        pagination: sameRequest
          ? current.pagination
          : createEmptyPagination(page, perPage),
        error: null,
        hasLoaded: sameRequest && current.hasLoaded,
      };
    });

    void fetchShipmentExceptionsApi(query)
      .then((response: ApiPaginationResponse<ShipmentExceptionListItem>) => {
        if (!active || requestSequence.current !== currentRequest) {
          return;
        }

        const lastValidPage = Math.max(
          response.meta.pagination.total_pages,
          1,
        );

        if (page > lastValidPage) {
          setPageState(lastValidPage);
          return;
        }

        setListState({
          requestKey,
          sessionContext,
          status: "success",
          data: response.data,
          pagination: response.meta.pagination,
          error: null,
          hasLoaded: true,
        });
      })
      .catch((error: unknown) => {
        if (!active || requestSequence.current !== currentRequest) {
          return;
        }

        setListState((current) => ({
          requestKey,
          sessionContext,
          status: "error",
          data:
            current.requestKey === requestKey &&
            current.sessionContext === sessionContext
              ? current.data
              : [],
          pagination:
            current.requestKey === requestKey &&
            current.sessionContext === sessionContext
              ? current.pagination
              : createEmptyPagination(page, perPage),
          error,
          hasLoaded:
            current.requestKey === requestKey &&
            current.sessionContext === sessionContext &&
            current.hasLoaded,
        }));
      });

    return () => {
      active = false;
      if (requestSequence.current === currentRequest) {
        requestSequence.current += 1;
      }
    };
  }, [
    page,
    perPage,
    query,
    refreshVersion,
    requestKey,
    sessionActive,
    sessionContext,
  ]);

  const setActiveTab = useCallback(
    (tab: ShipmentExceptionsTab) => {
      if (tab === activeTab) {
        return;
      }

      setActiveTabState(tab);
      setPageState(1);
      closeDialog();
    },
    [activeTab, closeDialog],
  );

  const setSearchTerm = useCallback(
    (value: string) => {
      if (value === searchTerm) {
        return;
      }

      setSearchTermState(value);
      setPageState(1);
      closeDialog();
    },
    [closeDialog, searchTerm],
  );

  const setPage = useCallback(
    (nextPage: number): boolean => {
      const maxPage = Math.max(pagination.total_pages, 1);

      if (
        !Number.isSafeInteger(nextPage) ||
        nextPage < 1 ||
        nextPage > maxPage
      ) {
        return false;
      }

      if (nextPage !== page) {
        setPageState(nextPage);
        closeDialog();
      }

      return true;
    },
    [closeDialog, page, pagination.total_pages],
  );

  const setPageSize = useCallback(
    (nextPerPage: number): boolean => {
      if (
        !Number.isSafeInteger(nextPerPage) ||
        nextPerPage < 1 ||
        nextPerPage > 100
      ) {
        return false;
      }

      if (nextPerPage !== perPage) {
        setPerPageState(nextPerPage);
        setPageState(1);
        closeDialog();
      }

      return true;
    },
    [closeDialog, perPage],
  );

  const refresh = useCallback(() => {
    closeDialog();
    setRefreshVersion((current) => current + 1);
  }, [closeDialog]);

  const retry = refresh;

  const loadInheritedInfo = useCallback(
    (publicId: string) => {
      const currentRequest = ++inheritedRequestSequence.current;
      setInheritedInfoState({
        publicId,
        dialogContextKey,
        sessionContext,
        status: "loading",
        data: null,
        error: null,
      });

      void getShipmentInheritedInfo(publicId)
        .then((info) => {
          if (inheritedRequestSequence.current !== currentRequest) {
            return;
          }

          setInheritedInfoState({
            publicId,
            dialogContextKey,
            sessionContext,
            status: info ? "ready" : "unavailable",
            data: info,
            error: null,
          });
        })
        .catch((error: unknown) => {
          if (inheritedRequestSequence.current !== currentRequest) {
            return;
          }

          setInheritedInfoState({
            publicId,
            dialogContextKey,
            sessionContext,
            status: "error",
            data: null,
            error,
          });
        });
    },
    [dialogContextKey, sessionContext],
  );

  const openReturnDialog = useCallback(
    (publicId: string): boolean => {
      const shipment = shipments.find((item) => item.public_id === publicId);

      if (
        !sessionActive ||
        !capabilities.canOpenReturnModal ||
        !shipment ||
        shipment.status !== "pending_return"
      ) {
        return false;
      }

      setForwardSubmitBlockedForSession(null);
      setDialog({
        kind: "return",
        publicId: shipment.public_id,
        requestKey: dialogContextKey,
        sessionKey,
        sessionContext,
      });
      loadInheritedInfo(shipment.public_id);
      return true;
    },
    [
      capabilities.canOpenReturnModal,
      dialogContextKey,
      loadInheritedInfo,
      sessionActive,
      sessionKey,
      sessionContext,
      shipments,
    ],
  );

  const openForwardDialog = useCallback(
    (publicId: string): boolean => {
      const shipment = shipments.find((item) => item.public_id === publicId);
      const forwardableStatus =
        shipment?.status === "delivery_failed" ||
        shipment?.status === "pending_return";

      if (
        !sessionActive ||
        !capabilities.canOpenForwardModal ||
        !shipment ||
        !forwardableStatus
      ) {
        return false;
      }

      forwardForm.reset(createEmptyForwardFormValues());
      setForwardSubmitBlockedForSession(null);
      setDialog({
        kind: "forward",
        publicId: shipment.public_id,
        requestKey: dialogContextKey,
        sessionKey,
        sessionContext,
      });
      loadInheritedInfo(shipment.public_id);
      return true;
    },
    [
      capabilities.canOpenForwardModal,
      dialogContextKey,
      forwardForm,
      loadInheritedInfo,
      sessionActive,
      sessionKey,
      sessionContext,
      shipments,
    ],
  );

  const validateForwardForm = useCallback(
    () => forwardForm.trigger(),
    [forwardForm],
  );

  const submitForwardForm = forwardForm.handleSubmit(async () => {
    setForwardSubmitBlockedForSession(sessionContext);
  });

  const isLoading = visibleListState.status === "loading";
  const isRefreshing = visibleListState.status === "refreshing";
  const isError = visibleListState.status === "error";
  const isEmpty =
    visibleListState.status === "success" && shipments.length === 0;
  const isSearchEmpty = isEmpty && normalizedSearch.length > 0;
  const errorKind = isError
    ? getErrorKind(visibleListState.error)
    : null;
  const errorMessage = isError
    ? getErrorMessage(visibleListState.error)
    : null;
  const dataSource: ShipmentExceptionDataSource = USE_MOCK
    ? "mock"
    : "backend";
  const canCreateForwardShipment = false;
  const canCreateReturnShipment = false;
  const canApproveRedelivery = false;
  const forwardMutationBlockedReason =
    forwardSubmitBlockedReason ??
    (canCreateForwardShipment ? null : FORWARD_MUTATION_BLOCKED_REASON);

  return {
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    appliedSearch: normalizedSearch,
    page,
    perPage,
    pagination,
    setPage,
    setPageSize,
    shipments,
    isLoading,
    isRefreshing,
    isError,
    error: visibleListState.error,
    errorKind,
    errorMessage,
    isEmpty,
    isSearchEmpty,
    refresh,
    retry,
    dataSource,
    isReadOnlyMockPreview: USE_MOCK && !hasShipmentReadPermission,
    hasShipmentReadPermission,
    capabilities: {
      ...capabilities,
      canCreateReturnShipment,
      canCreateForwardShipment,
      canApproveRedelivery,
    },
    selectedShipment,
    selectedShipmentPublicId: effectiveDialog?.publicId ?? null,
    inheritedInfo: inheritedInfo?.data ?? null,
    inheritedInfoStatus: inheritedInfo?.status ?? "idle",
    inheritedInfoError: inheritedInfo?.error ?? null,
    returnDialog: {
      isOpen:
        effectiveDialog?.kind === "return" && selectedShipment !== null,
      onOpen: openReturnDialog,
      onClose: closeDialog,
      unavailableReason:
        capabilities.unavailableReason ??
        "API chuyển hoàn chưa có contract khả dụng.",
      canCreate: false,
    },
    forwardDialog: {
      isOpen:
        effectiveDialog?.kind === "forward" && selectedShipment !== null,
      onOpen: openForwardDialog,
      onClose: closeDialog,
      unavailableReason:
        capabilities.unavailableReason ??
        "API chuyển tiếp chưa khả dụng.",
      canCreate: false,
      form: forwardForm,
      formState: forwardFormState,
      validate: validateForwardForm,
      onSubmit: submitForwardForm,
      submitBlockedReason: forwardMutationBlockedReason,
    },
    catalogAvailable: false,
    catalogUnavailableReason: CATALOG_UNAVAILABLE_REASON,
    redeliveryAvailable: false,
    redeliveryUnavailableReason:
      "Chưa có endpoint contract chính thức để duyệt tiếp tục giao lại.",
  };
}
