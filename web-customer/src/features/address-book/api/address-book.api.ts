import { USE_MOCK } from "@/core/api/axiosClient";
import addressBookMock from "@/mocks/addressBook.mock.json";
import branchesMock from "@/mocks/branches.mock.json";
import { createAddressBookSchema } from "../schemas/address-book.schema";
import type {
  AddressBookDataSource,
  AddressBookActiveFlag,
  AddressBookDistrict,
  AddressBookFormMode,
  AddressBookFormValues,
  AddressBookMockAddressListItem,
  AddressBookProvince,
  AddressType,
  AddressBookWard,
} from "../types/address-book.types";

const MOCK_NOTICE =
  "Dữ liệu địa chỉ minh họa chỉ tồn tại trong bộ nhớ của phiên hiện tại; chưa được lưu vào Backend.";
const BACKEND_UNAVAILABLE_MESSAGE =
  "Backend quản lý sổ địa chỉ chưa được kết nối.";

type MockErrorReason =
  | "BACKEND_UNAVAILABLE"
  | "INVALID_FORM"
  | "NOT_FOUND"
  | "DEFAULT_UNAVAILABLE";

export class AddressBookApiError extends Error {
  readonly reason: MockErrorReason;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    reason: MockErrorReason,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AddressBookApiError";
    this.reason = reason;
    this.fieldErrors = fieldErrors;
  }
}

export interface AddressBookMockResult<T> {
  source: AddressBookDataSource;
  notice: string;
  data: T;
}

export interface AddressBookCatalogs {
  provinces: AddressBookProvince[];
  districts: AddressBookDistrict[];
  wards: AddressBookWard[];
}

export interface AddressBookMockRecord {
  mock_id: string;
  public_id?: string;
  address_type: AddressBookMockAddressListItem["address_type"];
  label: string;
  contact_name: string;
  phone_masked: string;
  province_id: number;
  district_id: number;
  ward_id: number;
  address_line: string;
  is_default: boolean;
  latitude?: number;
  longitude?: number;
  created_at?: string;
  updated_at?: string;
}

type CatalogIdentifier = number | string;

function assertMockEnabled(): void {
  if (!USE_MOCK) {
    throw new AddressBookApiError(
      BACKEND_UNAVAILABLE_MESSAGE,
      "BACKEND_UNAVAILABLE",
    );
  }
}

function identifierKey(identifier: CatalogIdentifier): string | null {
  if (typeof identifier === "string") {
    return identifier;
  }

  return Number.isSafeInteger(identifier) ? String(identifier) : null;
}

function copyAddressBookRecord(
  record: AddressBookMockRecord,
): AddressBookMockRecord {
  return { ...record };
}

function toMockResult<T>(data: T): AddressBookMockResult<T> {
  return {
    source: "mock",
    notice: MOCK_NOTICE,
    data,
  };
}

function toActiveFlag(value: number, fieldName: string): AddressBookActiveFlag {
  if (value === 0 || value === 1) {
    return value;
  }

  throw new Error(`Giá trị ${fieldName} không hợp lệ trong dữ liệu địa giới.`);
}

function toAddressType(value: string): AddressType {
  if (value === "sender" || value === "receiver" || value === "both") {
    return value;
  }

  throw new Error("Loại địa chỉ không hợp lệ trong dữ liệu minh họa.");
}

function getActiveProvinces(): AddressBookProvince[] {
  return branchesMock.success_response.data.provinces
    .filter((province) => province.is_active === 1)
    .map((province) => ({
      id: province.id,
      code: province.code,
      name: province.name,
      region: province.region,
      is_active: toActiveFlag(province.is_active, "province.is_active"),
    }));
}

function getActiveDistricts(): AddressBookDistrict[] {
  return branchesMock.success_response.data.districts
    .filter((district) => district.is_active === 1)
    .map((district) => ({
      id: district.id,
      province_id: district.province_id,
      code: district.code,
      name: district.name,
      is_remote_area: toActiveFlag(
        district.is_remote_area,
        "district.is_remote_area",
      ),
      is_active: toActiveFlag(district.is_active, "district.is_active"),
    }));
}

function getActiveWards(): AddressBookWard[] {
  return branchesMock.success_response.data.wards
    .filter((ward) => ward.is_active === 1)
    .map((ward) => ({
      id: ward.id,
      district_id: ward.district_id,
      code: ward.code,
      name: ward.name,
      is_active: toActiveFlag(ward.is_active, "ward.is_active"),
    }));
}

export async function getAddressBookProvinces(): Promise<
  AddressBookMockResult<AddressBookProvince[]>
> {
  assertMockEnabled();
  return toMockResult(getActiveProvinces());
}

export async function getAddressBookDistricts(
  provinceId: string,
): Promise<AddressBookMockResult<AddressBookDistrict[]>> {
  assertMockEnabled();

  const requestedProvinceId = provinceId.trim();
  const knownProvince = getActiveProvinces().some(
    (province) => identifierKey(province.id) === requestedProvinceId,
  );
  const districts = knownProvince
    ? getActiveDistricts().filter(
        (district) =>
          identifierKey(district.province_id) === requestedProvinceId,
      )
    : [];

  return toMockResult(districts);
}

export async function getAddressBookWards(
  districtId: string,
): Promise<AddressBookMockResult<AddressBookWard[]>> {
  assertMockEnabled();

  const requestedDistrictId = districtId.trim();
  const knownDistrict = getActiveDistricts().some(
    (district) => identifierKey(district.id) === requestedDistrictId,
  );
  const wards = knownDistrict
    ? getActiveWards().filter(
        (ward) => identifierKey(ward.district_id) === requestedDistrictId,
      )
    : [];

  return toMockResult(wards);
}

export async function getAddressBookCatalogs(): Promise<
  AddressBookMockResult<AddressBookCatalogs>
> {
  assertMockEnabled();

  return toMockResult({
    provinces: getActiveProvinces(),
    districts: getActiveDistricts(),
    wards: getActiveWards(),
  });
}

function createMockId(records: readonly AddressBookMockRecord[]): string {
  let mockId = "";
  do {
    mockId = `mock:${crypto.randomUUID()}`;
  } while (records.some((record) => record.mock_id === mockId));

  return mockId;
}

function createInitialRecords(): AddressBookMockRecord[] {
  const detail = addressBookMock.success_response.data;

  return addressBookMock.pagination_response.data.reduce<
    AddressBookMockRecord[]
  >((records, address) => {
    const detailFields =
      detail.public_id === address.public_id
        ? {
            latitude: detail.latitude,
            longitude: detail.longitude,
            created_at: detail.created_at,
            updated_at: detail.updated_at,
          }
        : {};

    const record: AddressBookMockRecord = {
      mock_id: createMockId(records),
      public_id: address.public_id,
      address_type: toAddressType(address.address_type),
      label: address.label,
      contact_name: address.contact_name,
      phone_masked: address.phone_masked,
      province_id: address.province_id,
      district_id: address.district_id,
      ward_id: address.ward_id,
      address_line: address.address_line,
      is_default: address.is_default === 1,
      ...detailFields,
    };
    records.push(record);
    return records;
  }, []);
}

function maskPhoneForDemo(phone: string): string {
  if (phone.length <= 7) {
    return "*".repeat(phone.length);
  }

  return `${phone.slice(0, 3)}${"*".repeat(phone.length - 7)}${phone.slice(-4)}`;
}

function getFormFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string[]> {
  return issues.reduce<Record<string, string[]>>((fieldErrors, issue) => {
    const field = issue.path.map(String).join(".");
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
    return fieldErrors;
  }, {});
}

function validateForm(
  mode: AddressBookFormMode,
  values: AddressBookFormValues,
): AddressBookFormValues {
  const validationSchema = createAddressBookSchema(
    mode,
    getActiveProvinces(),
    getActiveDistricts(),
    getActiveWards(),
  );
  const validation = validationSchema.safeParse(values);

  if (!validation.success) {
    throw new AddressBookApiError(
      validation.error.issues[0]?.message ??
        "Vui lòng kiểm tra lại thông tin địa chỉ.",
      "INVALID_FORM",
      getFormFieldErrors(validation.error.issues),
    );
  }

  return validation.data;
}

function findGeographyForForm(values: AddressBookFormValues): {
  province: AddressBookProvince;
  district: AddressBookDistrict;
  ward: AddressBookWard;
} {
  const province = getActiveProvinces().find(
    (item) => identifierKey(item.id) === values.province_id,
  );
  const district = getActiveDistricts().find(
    (item) => identifierKey(item.id) === values.district_id,
  );
  const ward = getActiveWards().find(
    (item) => identifierKey(item.id) === values.ward_id,
  );

  if (!province || !district || !ward) {
    throw new AddressBookApiError(
      "Địa chỉ đã chọn không còn khả dụng.",
      "INVALID_FORM",
    );
  }

  return { province, district, ward };
}

function throwDefaultUnavailable(): never {
  throw new AddressBookApiError(
    "Thao tác đặt hoặc thay đổi địa chỉ mặc định chưa khả dụng.",
    "DEFAULT_UNAVAILABLE",
  );
}

export function createAddressBookApi() {
  const records = createInitialRecords();

  return {
    async getAddresses(): Promise<
      AddressBookMockResult<AddressBookMockRecord[]>
    > {
      assertMockEnabled();
      return toMockResult(records.map(copyAddressBookRecord));
    },

    async createAddress(
      values: AddressBookFormValues,
    ): Promise<AddressBookMockResult<AddressBookMockRecord>> {
      assertMockEnabled();
      const validatedValues = validateForm({ mode: "create" }, values);

      if (validatedValues.is_default) {
        return throwDefaultUnavailable();
      }

      const { province, district, ward } =
        findGeographyForForm(validatedValues);
      const record: AddressBookMockRecord = {
        mock_id: createMockId(records),
        address_type: validatedValues.address_type,
        label: validatedValues.label,
        contact_name: validatedValues.contact_name,
        phone_masked: maskPhoneForDemo(validatedValues.phone),
        province_id: province.id,
        district_id: district.id,
        ward_id: ward.id,
        address_line: validatedValues.address_line,
        is_default: false,
      };

      records.push(record);
      return toMockResult(copyAddressBookRecord(record));
    },

    async updateAddress(
      mockId: string,
      values: AddressBookFormValues,
    ): Promise<AddressBookMockResult<AddressBookMockRecord>> {
      assertMockEnabled();
      const recordIndex = records.findIndex(
        (record) => record.mock_id === mockId,
      );

      if (recordIndex < 0) {
        throw new AddressBookApiError(
          "Không tìm thấy địa chỉ trong dữ liệu minh họa.",
          "NOT_FOUND",
        );
      }

      const existingRecord = records[recordIndex];
      const validatedValues = validateForm(
        { mode: "edit", public_id: existingRecord.public_id ?? mockId },
        values,
      );

      if (
        validatedValues.is_default !== existingRecord.is_default ||
        (existingRecord.is_default &&
          validatedValues.address_type !== existingRecord.address_type)
      ) {
        return throwDefaultUnavailable();
      }

      const { province, district, ward } =
        findGeographyForForm(validatedValues);
      const updatedRecord: AddressBookMockRecord = {
        ...existingRecord,
        address_type: validatedValues.address_type,
        label: validatedValues.label,
        contact_name: validatedValues.contact_name,
        phone_masked:
          validatedValues.phone.length > 0
            ? maskPhoneForDemo(validatedValues.phone)
            : existingRecord.phone_masked,
        province_id: province.id,
        district_id: district.id,
        ward_id: ward.id,
        address_line: validatedValues.address_line,
      };

      records[recordIndex] = updatedRecord;
      return toMockResult(copyAddressBookRecord(updatedRecord));
    },

    async deleteAddress(
      mockId: string,
    ): Promise<AddressBookMockResult<{ mock_id: string }>> {
      assertMockEnabled();
      const recordIndex = records.findIndex(
        (record) => record.mock_id === mockId,
      );

      if (recordIndex < 0) {
        throw new AddressBookApiError(
          "Không tìm thấy địa chỉ trong dữ liệu minh họa.",
          "NOT_FOUND",
        );
      }

      if (records[recordIndex].is_default) {
        return throwDefaultUnavailable();
      }

      records.splice(recordIndex, 1);
      return toMockResult({ mock_id: mockId });
    },

    async setDefaultAddress(_mockId: string): Promise<never> {
      assertMockEnabled();
      return throwDefaultUnavailable();
    },
  };
}
