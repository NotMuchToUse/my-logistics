import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  useCustomerAuthStore,
  type CustomerAuthState,
} from "@/core/stores/useCustomerAuthStore";
import {
  AddressBookApiError,
  createAddressBookApi,
  getAddressBookCatalogs,
  getAddressBookDistricts,
  getAddressBookWards,
  type AddressBookCatalogs,
  type AddressBookMockRecord,
  type AddressBookMockResult,
} from "../api/address-book.api";
import { createAddressBookSchema } from "../schemas/address-book.schema";
import type {
  AddressBookDataSource,
  AddressBookFormInputValues,
  AddressBookFormMode,
  AddressBookFormValues,
  AddressBookTypeFilter,
} from "../types/address-book.types";

const EMPTY_FORM_VALUES: AddressBookFormInputValues = {
  label: "",
  contact_name: "",
  phone: "",
  address_type: "",
  province_id: "",
  district_id: "",
  ward_id: "",
  address_line: "",
  is_default: false,
};

const EMPTY_CATALOGS: AddressBookCatalogs = {
  provinces: [],
  districts: [],
  wards: [],
};
const EMPTY_ADDRESSES: AddressBookMockRecord[] = [];

const MOCK_SUCCESS_NOTICE =
  "Thao tác minh họa hoàn tất trong bộ nhớ của phiên hiện tại; chưa lưu lên hệ thống thật.";
const DEFAULT_ADDRESS_NOTICE =
  "Thao tác với địa chỉ mặc định chưa khả dụng trong bản minh họa; đây không phải quy tắc đã xác nhận của Backend.";
const SESSION_UNAVAILABLE_MESSAGE =
  "Vui lòng đăng nhập để quản lý sổ địa chỉ.";

interface SessionApi {
  sessionKey: string;
  generation: number;
  api: ReturnType<typeof createAddressBookApi>;
}

interface AddressListState {
  sessionKey: string | null;
  addresses: AddressBookMockRecord[];
  isLoading: boolean;
  error: string | null;
  source: AddressBookDataSource | null;
  notice: string | null;
  backendUnavailable: boolean;
}

interface AddressCatalogState {
  sessionKey: string | null;
  catalogs: AddressBookCatalogs;
  isLoading: boolean;
  error: string | null;
  backendUnavailable: boolean;
}

const EMPTY_ADDRESS_LIST_STATE: AddressListState = {
  sessionKey: null,
  addresses: EMPTY_ADDRESSES,
  isLoading: false,
  error: null,
  source: null,
  notice: null,
  backendUnavailable: false,
};

const EMPTY_ADDRESS_CATALOG_STATE: AddressCatalogState = {
  sessionKey: null,
  catalogs: EMPTY_CATALOGS,
  isLoading: false,
  error: null,
  backendUnavailable: false,
};

function getSessionKey(
  isAuthenticated: boolean,
  userPublicId: string | null,
  customerPublicId: string | null,
): string | null {
  return isAuthenticated && userPublicId
    ? JSON.stringify([userPublicId, customerPublicId])
    : null;
}

function getAuthSessionKey(state: CustomerAuthState): string | null {
  return getSessionKey(
    state.isAuthenticated,
    state.user?.public_id ?? null,
    state.customer?.public_id ?? null,
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

function getSelectedAddressId(id: number): string {
  return String(id);
}

function containsAddress(
  addresses: readonly AddressBookMockRecord[],
  addressId: string,
): boolean {
  return addresses.some((address) => address.mock_id === addressId);
}

export function useAddressBook() {
  const isAuthenticated = useCustomerAuthStore(
    (state) => state.isAuthenticated,
  );
  const userPublicId = useCustomerAuthStore(
    (state) => state.user?.public_id ?? null,
  );
  const customerPublicId = useCustomerAuthStore(
    (state) => state.customer?.public_id ?? null,
  );
  const sessionKey = getSessionKey(
    isAuthenticated,
    userPublicId,
    customerPublicId,
  );
  const [listState, setListState] = useState<AddressListState>(
    EMPTY_ADDRESS_LIST_STATE,
  );
  const [addressTypeFilter, setAddressTypeFilter] =
    useState<AddressBookTypeFilter>("all");
  const [catalogState, setCatalogState] = useState<AddressCatalogState>(
    EMPTY_ADDRESS_CATALOG_STATE,
  );
  const [districts, setDistricts] = useState<
    AddressBookCatalogs["districts"]
  >([]);
  const [wards, setWards] = useState<AddressBookCatalogs["wards"]>([]);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);
  const [isLoadingWards, setIsLoadingWards] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isDeletingAddress, setIsDeletingAddress] = useState(false);
  const [geographyError, setGeographyError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<AddressBookFormMode>({
    mode: "create",
  });
  const [editingAddress, setEditingAddress] =
    useState<AddressBookMockRecord | null>(null);
  const [pendingDeleteAddress, setPendingDeleteAddress] =
    useState<AddressBookMockRecord | null>(null);

  const apiRef = useRef<SessionApi | null>(null);
  const sessionGenerationRef = useRef(0);
  const listRequestIdRef = useRef(0);
  const catalogRequestIdRef = useRef(0);
  const districtRequestIdRef = useRef(0);
  const wardRequestIdRef = useRef(0);
  const formRequestIdRef = useRef(0);
  const saveRequestIdRef = useRef(0);
  const deleteRequestIdRef = useRef(0);
  const saveLockRef = useRef(false);
  const deleteLockRef = useRef(false);

  const schema = useMemo(
    () =>
      createAddressBookSchema(
        formMode,
        sessionKey !== null && catalogState.sessionKey === sessionKey
          ? catalogState.catalogs.provinces
          : EMPTY_CATALOGS.provinces,
        sessionKey !== null && catalogState.sessionKey === sessionKey
          ? catalogState.catalogs.districts
          : EMPTY_CATALOGS.districts,
        sessionKey !== null && catalogState.sessionKey === sessionKey
          ? catalogState.catalogs.wards
          : EMPTY_CATALOGS.wards,
      ),
    [catalogState, formMode, sessionKey],
  );

  const form = useForm<
    AddressBookFormInputValues,
    unknown,
    AddressBookFormValues
  >({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_FORM_VALUES,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const resetFormValues = form.reset;
  const isFormSubmitted = form.formState.isSubmitted;
  const selectedProvinceId = useWatch({
    control: form.control,
    name: "province_id",
  });
  const selectedDistrictId = useWatch({
    control: form.control,
    name: "district_id",
  });
  const selectedWardId = useWatch({
    control: form.control,
    name: "ward_id",
  });

  const hasCurrentSession =
    sessionKey !== null && listState.sessionKey === sessionKey;
  const hasCurrentCatalogs =
    sessionKey !== null && catalogState.sessionKey === sessionKey;
  const addresses = hasCurrentSession
    ? listState.addresses
    : EMPTY_ADDRESSES;
  const catalogs = hasCurrentCatalogs
    ? catalogState.catalogs
    : EMPTY_CATALOGS;
  const geographyCatalogs = hasCurrentCatalogs ? catalogs : null;
  const dataSource = hasCurrentSession ? listState.source : null;
  const mockNotice = hasCurrentSession ? listState.notice : null;
  const listError = hasCurrentSession ? listState.error : null;
  const catalogError = hasCurrentCatalogs ? catalogState.error : null;
  const isBackendUnavailable =
    (hasCurrentSession && listState.backendUnavailable) ||
    (hasCurrentCatalogs && catalogState.backendUnavailable);
  const isLoadingAddresses =
    sessionKey !== null &&
    (!hasCurrentSession || listState.isLoading);
  const isLoadingCatalogs =
    sessionKey !== null &&
    (!hasCurrentCatalogs || catalogState.isLoading);
  const isMockData = hasCurrentSession && dataSource === "mock";
  const canMutateAddresses = isMockData;
  const canOpenForm =
    canMutateAddresses &&
    hasCurrentCatalogs &&
    !isLoadingCatalogs &&
    catalogError === null &&
    catalogs.provinces.length > 0 &&
    catalogs.districts.length > 0 &&
    catalogs.wards.length > 0;
  const formUnavailableMessage = isBackendUnavailable
    ? "Backend quản lý sổ địa chỉ chưa được kết nối."
    : catalogError ??
      listError ??
      "Danh mục địa chỉ chưa sẵn sàng.";

  const filteredAddresses = useMemo(() => {
    switch (addressTypeFilter) {
      case "sender":
        return addresses.filter(
          (address) =>
            address.address_type === "sender" ||
            address.address_type === "both",
        );
      case "receiver":
        return addresses.filter(
          (address) =>
            address.address_type === "receiver" ||
            address.address_type === "both",
        );
      case "both":
        return addresses.filter((address) => address.address_type === "both");
      case "all":
      default:
        return addresses;
    }
  }, [addressTypeFilter, addresses]);

  const apiForCurrentSession = useCallback((): SessionApi | null => {
    const currentApi = apiRef.current;
    if (!sessionKey || currentApi?.sessionKey !== sessionKey) {
      return null;
    }

    return currentApi;
  }, [sessionKey]);

  const reloadAddresses = useCallback(async (): Promise<void> => {
    const currentApi = apiForCurrentSession();
    if (!currentApi) {
      return;
    }

    const requestId = ++listRequestIdRef.current;
    setListState((currentState) => ({
      sessionKey: currentApi.sessionKey,
      addresses:
        currentState.sessionKey === currentApi.sessionKey
          ? currentState.addresses
          : EMPTY_ADDRESSES,
      isLoading: true,
      error: null,
      source:
        currentState.sessionKey === currentApi.sessionKey
          ? currentState.source
          : null,
      notice:
        currentState.sessionKey === currentApi.sessionKey
          ? currentState.notice
          : null,
      backendUnavailable: false,
    }));
    setOperationError(null);

    try {
      const result = await currentApi.api.getAddresses();
      if (
        requestId !== listRequestIdRef.current ||
        apiRef.current !== currentApi
      ) {
        return;
      }

      setListState({
        sessionKey: currentApi.sessionKey,
        addresses: result.data,
        isLoading: false,
        error: null,
        source: result.source,
        notice: result.notice,
        backendUnavailable: false,
      });
    } catch (error: unknown) {
      if (
        requestId === listRequestIdRef.current &&
        apiRef.current === currentApi
      ) {
        setListState((currentState) => ({
          ...currentState,
          sessionKey: currentApi.sessionKey,
          isLoading: false,
          error: getErrorMessage(error),
          backendUnavailable:
            error instanceof AddressBookApiError &&
            error.reason === "BACKEND_UNAVAILABLE",
        }));
      }
    } finally {
      if (
        requestId === listRequestIdRef.current &&
        apiRef.current === currentApi
      ) {
        setListState((currentState) => ({
          ...currentState,
          isLoading: false,
        }));
      }
    }
  }, [apiForCurrentSession]);

  const reloadCatalogs = useCallback(async (): Promise<void> => {
    const currentApi = apiForCurrentSession();
    if (!currentApi) {
      return;
    }

    const requestId = ++catalogRequestIdRef.current;
    setCatalogState((currentState) => ({
      sessionKey: currentApi.sessionKey,
      catalogs:
        currentState.sessionKey === currentApi.sessionKey
          ? currentState.catalogs
          : EMPTY_CATALOGS,
      isLoading: true,
      error: null,
      backendUnavailable: false,
    }));

    try {
      const result = await getAddressBookCatalogs();
      if (
        requestId !== catalogRequestIdRef.current ||
        apiRef.current !== currentApi
      ) {
        return;
      }

      setCatalogState({
        sessionKey: currentApi.sessionKey,
        catalogs: result.data,
        isLoading: false,
        error: null,
        backendUnavailable: false,
      });
      setGeographyError(null);
    } catch (error: unknown) {
      if (
        requestId === catalogRequestIdRef.current &&
        apiRef.current === currentApi
      ) {
        setCatalogState((currentState) => ({
          ...currentState,
          sessionKey: currentApi.sessionKey,
          isLoading: false,
          error: getErrorMessage(error),
          backendUnavailable:
            error instanceof AddressBookApiError &&
            error.reason === "BACKEND_UNAVAILABLE",
        }));
      }
    }
  }, [apiForCurrentSession]);

  useEffect(() => {
    return useCustomerAuthStore.subscribe((state, previousState) => {
      if (getAuthSessionKey(state) === getAuthSessionKey(previousState)) {
        return;
      }

      apiRef.current = null;
      sessionGenerationRef.current += 1;
      listRequestIdRef.current += 1;
      catalogRequestIdRef.current += 1;
      districtRequestIdRef.current += 1;
      wardRequestIdRef.current += 1;
      formRequestIdRef.current += 1;
      saveRequestIdRef.current += 1;
      deleteRequestIdRef.current += 1;
      saveLockRef.current = false;
      deleteLockRef.current = false;
      setListState(EMPTY_ADDRESS_LIST_STATE);
      setAddressTypeFilter("all");
      setCatalogState(EMPTY_ADDRESS_CATALOG_STATE);
      setDistricts([]);
      setWards([]);
      setIsLoadingDistricts(false);
      setIsLoadingWards(false);
      setIsSavingAddress(false);
      setIsDeletingAddress(false);
      setGeographyError(null);
      setOperationError(null);
      setIsFormOpen(false);
      setFormMode({ mode: "create" });
      setEditingAddress(null);
      setPendingDeleteAddress(null);
      resetFormValues(EMPTY_FORM_VALUES);
    });
  }, [resetFormValues]);

  useEffect(() => {
    const generation = ++sessionGenerationRef.current;
    let isActive = true;
    const initialListRequestId = ++listRequestIdRef.current;
    const initialCatalogRequestId = ++catalogRequestIdRef.current;
    districtRequestIdRef.current += 1;
    wardRequestIdRef.current += 1;
    formRequestIdRef.current += 1;
    saveRequestIdRef.current += 1;
    deleteRequestIdRef.current += 1;

    if (!sessionKey) {
      return () => {
        isActive = false;
        if (sessionGenerationRef.current === generation) {
          sessionGenerationRef.current += 1;
        }
      };
    }

    const currentApi: SessionApi = {
      sessionKey,
      generation,
      api: createAddressBookApi(),
    };
    apiRef.current = currentApi;

    async function loadInitialAddresses(): Promise<void> {
      try {
        const result = await currentApi.api.getAddresses();
        if (
          !isActive ||
          initialListRequestId !== listRequestIdRef.current ||
          sessionGenerationRef.current !== generation ||
          apiRef.current !== currentApi
        ) {
          return;
        }

        setListState({
          sessionKey,
          addresses: result.data,
          isLoading: false,
          error: null,
          source: result.source,
          notice: result.notice,
          backendUnavailable: false,
        });
      } catch (error: unknown) {
        if (
          isActive &&
          initialListRequestId === listRequestIdRef.current &&
          sessionGenerationRef.current === generation &&
          apiRef.current === currentApi
        ) {
          setListState({
            sessionKey,
            addresses: EMPTY_ADDRESSES,
            isLoading: false,
            error: getErrorMessage(error),
            source: null,
            notice: null,
            backendUnavailable:
              error instanceof AddressBookApiError &&
              error.reason === "BACKEND_UNAVAILABLE",
          });
        }
      }
    }

    async function loadInitialCatalogs(): Promise<void> {
      try {
        const result = await getAddressBookCatalogs();
        if (
          !isActive ||
          initialCatalogRequestId !== catalogRequestIdRef.current ||
          sessionGenerationRef.current !== generation ||
          apiRef.current !== currentApi
        ) {
          return;
        }

        setCatalogState({
          sessionKey,
          catalogs: result.data,
          isLoading: false,
          error: null,
          backendUnavailable: false,
        });
      } catch (error: unknown) {
        if (
          isActive &&
          initialCatalogRequestId === catalogRequestIdRef.current &&
          sessionGenerationRef.current === generation &&
          apiRef.current === currentApi
        ) {
          setCatalogState({
            sessionKey,
            catalogs: EMPTY_CATALOGS,
            isLoading: false,
            error: getErrorMessage(error),
            backendUnavailable:
              error instanceof AddressBookApiError &&
              error.reason === "BACKEND_UNAVAILABLE",
          });
        }
      }
    }

    void loadInitialAddresses();
    void loadInitialCatalogs();

    return () => {
      isActive = false;
      if (apiRef.current === currentApi) {
        apiRef.current = null;
      }
      resetFormValues(EMPTY_FORM_VALUES);
      listRequestIdRef.current += 1;
      catalogRequestIdRef.current += 1;
      districtRequestIdRef.current += 1;
      wardRequestIdRef.current += 1;
      formRequestIdRef.current += 1;
      saveRequestIdRef.current += 1;
      deleteRequestIdRef.current += 1;
      if (sessionGenerationRef.current === generation) {
        sessionGenerationRef.current += 1;
      }
    };
  }, [resetFormValues, sessionKey]);

  const openAddForm = useCallback((): void => {
    if (!canOpenForm) {
      setOperationError(formUnavailableMessage);
      toast.error(formUnavailableMessage);
      return;
    }

    formRequestIdRef.current += 1;
    districtRequestIdRef.current += 1;
    wardRequestIdRef.current += 1;
    setDistricts([]);
    setWards([]);
    setIsLoadingDistricts(false);
    setIsLoadingWards(false);
    setGeographyError(null);
    setOperationError(null);
    setEditingAddress(null);
    setFormMode({ mode: "create" });
    form.reset(EMPTY_FORM_VALUES);
    setIsFormOpen(true);
  }, [canOpenForm, form, formUnavailableMessage]);

  const closeForm = useCallback((): void => {
    formRequestIdRef.current += 1;
    districtRequestIdRef.current += 1;
    wardRequestIdRef.current += 1;
    setIsFormOpen(false);
    setFormMode({ mode: "create" });
    setEditingAddress(null);
    setDistricts([]);
    setWards([]);
    setIsLoadingDistricts(false);
    setIsLoadingWards(false);
    setGeographyError(null);
    setOperationError(null);
    form.reset(EMPTY_FORM_VALUES);
  }, [form]);

  const openEditForm = useCallback(
    async (mockId: string): Promise<void> => {
      const currentApi = apiForCurrentSession();
      const address = addresses.find((item) => item.mock_id === mockId);
      if (!currentApi || !canOpenForm || !address) {
        const message = !currentApi
          ? SESSION_UNAVAILABLE_MESSAGE
          : !canOpenForm
            ? formUnavailableMessage
            : "Không tìm thấy địa chỉ cần chỉnh sửa trong phiên hiện tại.";
        setOperationError(message);
        toast.error(message);
        return;
      }

      const requestId = ++formRequestIdRef.current;
      districtRequestIdRef.current += 1;
      wardRequestIdRef.current += 1;
      setOperationError(null);
      setGeographyError(null);
      setEditingAddress(address);
      setFormMode({
        mode: "edit",
        public_id: address.public_id ?? "",
      });
      form.reset({
        label: address.label,
        contact_name: address.contact_name,
        phone: "",
        address_type: address.address_type,
        province_id: getSelectedAddressId(address.province_id),
        district_id: getSelectedAddressId(address.district_id),
        ward_id: getSelectedAddressId(address.ward_id),
        address_line: address.address_line,
        is_default: address.is_default,
      });
      setDistricts([]);
      setWards([]);
      setIsLoadingDistricts(true);
      setIsLoadingWards(true);
      setIsFormOpen(true);

      try {
        const [districtResult, wardResult] = await Promise.all([
          getAddressBookDistricts(getSelectedAddressId(address.province_id)),
          getAddressBookWards(getSelectedAddressId(address.district_id)),
        ]);
        if (
          requestId !== formRequestIdRef.current ||
          apiRef.current !== currentApi
        ) {
          return;
        }

        setDistricts(districtResult.data);
        setWards(wardResult.data);
      } catch (error: unknown) {
        if (
          requestId === formRequestIdRef.current &&
          apiRef.current === currentApi
        ) {
          setGeographyError(getErrorMessage(error));
        }
      } finally {
        if (
          requestId === formRequestIdRef.current &&
          apiRef.current === currentApi
        ) {
          setIsLoadingDistricts(false);
          setIsLoadingWards(false);
        }
      }
    },
    [
      addresses,
      apiForCurrentSession,
      canOpenForm,
      form,
      formUnavailableMessage,
    ],
  );

  const handleProvinceChange = useCallback(
    async (provinceId: string): Promise<void> => {
      form.setValue("province_id", provinceId, {
        shouldDirty: true,
        shouldTouch: true,
      });
      form.setValue("district_id", "", { shouldDirty: true });
      form.setValue("ward_id", "", { shouldDirty: true });
      setDistricts([]);
      setWards([]);
      const requestId = ++districtRequestIdRef.current;
      wardRequestIdRef.current += 1;
      setIsLoadingWards(false);
      const currentApi = apiForCurrentSession();
      setGeographyError(null);

      if (isFormSubmitted) {
        void form.trigger(["province_id", "district_id", "ward_id"]);
      }

      if (!provinceId) {
        setIsLoadingDistricts(false);
        return;
      }

      if (!currentApi) {
        setIsLoadingDistricts(false);
        return;
      }

      setIsLoadingDistricts(true);
      try {
        const result = await getAddressBookDistricts(provinceId);
        if (
          requestId === districtRequestIdRef.current &&
          apiRef.current === currentApi
        ) {
          setDistricts(result.data);
        }
      } catch (error: unknown) {
        if (
          requestId === districtRequestIdRef.current &&
          apiRef.current === currentApi
        ) {
          setGeographyError(getErrorMessage(error));
        }
      } finally {
        if (
          requestId === districtRequestIdRef.current &&
          apiRef.current === currentApi
        ) {
          setIsLoadingDistricts(false);
        }
      }
    },
    [
      apiForCurrentSession,
      form,
      isFormSubmitted,
    ],
  );

  const handleDistrictChange = useCallback(
    async (districtId: string): Promise<void> => {
      form.setValue("district_id", districtId, {
        shouldDirty: true,
        shouldTouch: true,
      });
      form.setValue("ward_id", "", { shouldDirty: true });
      setWards([]);
      const requestId = ++wardRequestIdRef.current;
      const currentApi = apiForCurrentSession();
      setGeographyError(null);
      if (isFormSubmitted) {
        void form.trigger(["district_id", "ward_id"]);
      }

      if (!districtId) {
        setIsLoadingWards(false);
        return;
      }

      if (!currentApi) {
        setIsLoadingWards(false);
        return;
      }

      setIsLoadingWards(true);
      try {
        const result = await getAddressBookWards(districtId);
        if (
          requestId === wardRequestIdRef.current &&
          apiRef.current === currentApi
        ) {
          setWards(result.data);
        }
      } catch (error: unknown) {
        if (
          requestId === wardRequestIdRef.current &&
          apiRef.current === currentApi
        ) {
          setGeographyError(getErrorMessage(error));
        }
      } finally {
        if (
          requestId === wardRequestIdRef.current &&
          apiRef.current === currentApi
        ) {
          setIsLoadingWards(false);
        }
      }
    },
    [
      apiForCurrentSession,
      form,
      isFormSubmitted,
    ],
  );

  const handleWardChange = useCallback(
    (wardId: string): void => {
      form.setValue("ward_id", wardId, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: isFormSubmitted,
      });
    },
    [form, isFormSubmitted],
  );

  const closeFormAfterSuccess = useCallback((): void => {
    formRequestIdRef.current += 1;
    districtRequestIdRef.current += 1;
    wardRequestIdRef.current += 1;
    setIsFormOpen(false);
    setFormMode({ mode: "create" });
    setEditingAddress(null);
    setDistricts([]);
    setWards([]);
    setIsLoadingDistricts(false);
    setIsLoadingWards(false);
    setGeographyError(null);
    setOperationError(null);
    form.reset(EMPTY_FORM_VALUES);
  }, [form]);

  const submitAddressValues = useCallback(
    async (values: AddressBookFormValues): Promise<void> => {
      if (saveLockRef.current) {
        return;
      }

      const currentApi = apiForCurrentSession();
      if (!currentApi || !canOpenForm) {
        const message = currentApi
          ? formUnavailableMessage
          : SESSION_UNAVAILABLE_MESSAGE;
        setOperationError(message);
        toast.error(message);
        return;
      }

      if (formMode.mode === "edit" && !editingAddress) {
        const message = "Không tìm thấy địa chỉ cần chỉnh sửa.";
        setOperationError(message);
        toast.error(message);
        return;
      }

      saveLockRef.current = true;
      const requestId = ++saveRequestIdRef.current;
      const formRequestId = formRequestIdRef.current;
      setIsSavingAddress(true);
      setOperationError(null);

      try {
        let result: AddressBookMockResult<AddressBookMockRecord>;
        if (formMode.mode === "create") {
          result = await currentApi.api.createAddress(values);
        } else if (editingAddress) {
          result = await currentApi.api.updateAddress(
            editingAddress.mock_id,
            values,
          );
        } else {
          throw new AddressBookApiError(
            "Không tìm thấy địa chỉ cần chỉnh sửa.",
            "NOT_FOUND",
          );
        }

        if (
          requestId !== saveRequestIdRef.current ||
          apiRef.current !== currentApi
        ) {
          return;
        }

        listRequestIdRef.current += 1;
        setListState((currentState) => {
          if (currentState.sessionKey !== currentApi.sessionKey) {
            return currentState;
          }

          const nextAddresses =
            formMode.mode === "create"
              ? [...currentState.addresses, result.data]
              : currentState.addresses.map((address) =>
                  address.mock_id === result.data.mock_id
                    ? result.data
                    : address,
                );

          return {
            ...currentState,
            addresses: nextAddresses,
            isLoading: false,
            error: null,
            source: result.source,
            notice: result.notice,
            backendUnavailable: false,
          };
        });
        if (formRequestId === formRequestIdRef.current) {
          setOperationError(null);
        }
        toast.success(MOCK_SUCCESS_NOTICE);

        if (formRequestId === formRequestIdRef.current) {
          closeFormAfterSuccess();
        }
      } catch (error: unknown) {
        if (
          requestId === saveRequestIdRef.current &&
          apiRef.current === currentApi &&
          formRequestId === formRequestIdRef.current
        ) {
          const message = getErrorMessage(error);
          setOperationError(message);
          toast.error(message);
        }
      } finally {
        if (requestId === saveRequestIdRef.current) {
          saveLockRef.current = false;
          if (apiRef.current === currentApi) {
            setIsSavingAddress(false);
          }
        }
      }
    },
    [
      apiForCurrentSession,
      canOpenForm,
      closeFormAfterSuccess,
      editingAddress,
      formUnavailableMessage,
      formMode,
    ],
  );

  const submitForm = form.handleSubmit(submitAddressValues);

  const requestDeleteAddress = useCallback(
    (mockId: string): void => {
      if (deleteLockRef.current) {
        return;
      }

      const currentApi = apiForCurrentSession();
      const address = addresses.find((item) => item.mock_id === mockId);
      if (!address) {
        const message = "Không tìm thấy địa chỉ cần xóa trong phiên hiện tại.";
        setOperationError(message);
        toast.error(message);
        return;
      }

      if (address.is_default) {
        setOperationError(DEFAULT_ADDRESS_NOTICE);
        toast.error(DEFAULT_ADDRESS_NOTICE);
        return;
      }

      if (!currentApi || !canMutateAddresses) {
        const message = currentApi
          ? "Backend quản lý sổ địa chỉ chưa được kết nối."
          : SESSION_UNAVAILABLE_MESSAGE;
        setOperationError(message);
        toast.error(message);
        return;
      }

      setOperationError(null);
      setPendingDeleteAddress(address);
    },
    [addresses, apiForCurrentSession, canMutateAddresses],
  );

  const cancelDeleteAddress = useCallback((): void => {
    if (deleteLockRef.current) {
      return;
    }

    setPendingDeleteAddress(null);
    setOperationError(null);
  }, []);

  const confirmDeleteAddress = useCallback(async (): Promise<void> => {
    if (deleteLockRef.current || !pendingDeleteAddress) {
      return;
    }

    const currentApi = apiForCurrentSession();
    if (!currentApi || !canMutateAddresses) {
      const message = currentApi
        ? "Backend quản lý sổ địa chỉ chưa được kết nối."
        : SESSION_UNAVAILABLE_MESSAGE;
      setOperationError(message);
      toast.error(message);
      return;
    }

    if (pendingDeleteAddress.is_default) {
      setOperationError(DEFAULT_ADDRESS_NOTICE);
      toast.error(DEFAULT_ADDRESS_NOTICE);
      return;
    }

    if (!containsAddress(addresses, pendingDeleteAddress.mock_id)) {
      const message = "Địa chỉ không còn tồn tại trong phiên hiện tại.";
      setOperationError(message);
      toast.error(message);
      setPendingDeleteAddress(null);
      return;
    }

    deleteLockRef.current = true;
    const requestId = ++deleteRequestIdRef.current;
    setIsDeletingAddress(true);
    setOperationError(null);

    try {
      const result = await currentApi.api.deleteAddress(
        pendingDeleteAddress.mock_id,
      );
      if (
        requestId !== deleteRequestIdRef.current ||
        apiRef.current !== currentApi
      ) {
        return;
      }

      listRequestIdRef.current += 1;
      setListState((currentState) =>
        currentState.sessionKey === currentApi.sessionKey
          ? {
              ...currentState,
              addresses: currentState.addresses.filter(
                (address) => address.mock_id !== result.data.mock_id,
              ),
              isLoading: false,
              error: null,
              source: result.source,
              notice: result.notice,
              backendUnavailable: false,
            }
          : currentState,
      );
      setPendingDeleteAddress(null);
      setOperationError(null);
      toast.success(MOCK_SUCCESS_NOTICE);
    } catch (error: unknown) {
      if (
        requestId === deleteRequestIdRef.current &&
        apiRef.current === currentApi
      ) {
        const message = getErrorMessage(error);
        setOperationError(message);
        toast.error(message);
      }
    } finally {
      if (requestId === deleteRequestIdRef.current) {
        deleteLockRef.current = false;
        if (apiRef.current === currentApi) {
          setIsDeletingAddress(false);
        }
      }
    }
  }, [
    addresses,
    apiForCurrentSession,
    canMutateAddresses,
    pendingDeleteAddress,
  ]);

  const canDeleteAddress = useCallback(
    (address: AddressBookMockRecord): boolean =>
      canMutateAddresses && !address.is_default,
    [canMutateAddresses],
  );
  const canChangeAddressType = useCallback(
    (address: AddressBookMockRecord): boolean =>
      canMutateAddresses && !address.is_default,
    [canMutateAddresses],
  );

  const isEditingGeographyUnavailable =
    isFormOpen &&
    formMode.mode === "edit" &&
    !isLoadingCatalogs &&
    (!catalogs.provinces.some(
      (province) => String(province.id) === selectedProvinceId,
    ) ||
      !catalogs.districts.some(
        (district) =>
          String(district.id) === selectedDistrictId &&
          String(district.province_id) === selectedProvinceId,
      ) ||
      !catalogs.wards.some(
        (ward) =>
          String(ward.id) === selectedWardId &&
          String(ward.district_id) === selectedDistrictId,
      ));

  const isAddressListEmpty =
    hasCurrentSession &&
    !isLoadingAddresses &&
    listError === null &&
    addresses.length === 0;
  const isCatalogEmpty =
    hasCurrentCatalogs &&
    !isLoadingCatalogs &&
    (catalogs.provinces.length === 0 ||
      catalogs.districts.length === 0 ||
      catalogs.wards.length === 0);
  const hasNoFilteredAddresses =
    addresses.length > 0 && filteredAddresses.length === 0;

  return {
    addresses,
    filteredAddresses,
    addressTypeFilter,
    setAddressTypeFilter,
    provinces: catalogs.provinces,
    districts,
    wards,
    geographyCatalogs,
    form,
    formMode,
    editingAddress,
    phoneMasked: editingAddress?.phone_masked ?? null,
    isFormOpen,
    isDeleteDialogOpen: pendingDeleteAddress !== null,
    pendingDeleteAddress,
    isLoadingAddresses,
    isLoadingCatalogs,
    isLoadingDistricts,
    isLoadingWards,
    isSavingAddress,
    isDeletingAddress,
    isLoading: isLoadingAddresses || isLoadingCatalogs,
    listError,
    catalogError,
    geographyError,
    operationError,
    isBackendUnavailable,
    isAddressListEmpty,
    isCatalogEmpty,
    hasNoFilteredAddresses,
    isEditingGeographyUnavailable,
    dataSource: hasCurrentSession ? dataSource : null,
    mockNotice: hasCurrentSession ? mockNotice : null,
    capabilities: {
      canCreateAddress: canOpenForm,
      canEditAddress: canOpenForm,
      canDeleteAddress,
      canChangeAddressType,
      canSetDefaultAddress: false,
      canChangeDefaultStatus: false,
      defaultAddressOperationsAvailable: false,
      defaultAddressNotice: DEFAULT_ADDRESS_NOTICE,
    },
    reloadAddresses,
    reloadCatalogs,
    openAddForm,
    openEditForm,
    closeForm,
    handleProvinceChange,
    handleDistrictChange,
    handleWardChange,
    submitForm,
    requestDeleteAddress,
    cancelDeleteAddress,
    confirmDeleteAddress,
  };
}
