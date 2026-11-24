import type {
  ApiErrorResponse,
  ApiPaginationResponse,
  ApiSuccessResponse,
} from "@/types/api.types";

// Frontend values observed in the fixture; the Database enum is unconfirmed.
export type AddressType = "sender" | "receiver" | "both";

export type AddressBookActiveFlag = 0 | 1;

export type AddressBookSelectId = string;

export interface AddressBookProvince {
  id: number;
  code: string;
  name: string;
  region: string;
  is_active: AddressBookActiveFlag;
}

export interface AddressBookDistrict {
  id: number;
  province_id: number;
  code: string;
  name: string;
  is_remote_area: AddressBookActiveFlag;
  is_active: AddressBookActiveFlag;
}

export interface AddressBookWard {
  id: number;
  district_id: number;
  code: string;
  name: string;
  is_active: AddressBookActiveFlag;
}

export interface AddressBookMockAddressBase {
  public_id: string;
  customer_id: number;
  address_type: AddressType;
  label: string;
  contact_name: string;
  phone_masked: string;
  province_id: number;
  district_id: number;
  ward_id: number;
  address_line: string;
  is_default: AddressBookActiveFlag;
}

export type AddressBookMockAddressListItem = AddressBookMockAddressBase;

export interface AddressBookMockAddressDetail
  extends AddressBookMockAddressBase {
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
}

export interface AddressBookMockData {
  success_response: ApiSuccessResponse<AddressBookMockAddressDetail>;
  pagination_response: ApiPaginationResponse<AddressBookMockAddressListItem>;
  error_response: ApiErrorResponse;
}

// Validated frontend values; these are not a Backend request contract.
export interface AddressBookFormValues {
  label: string;
  contact_name: string;
  phone: string;
  address_type: AddressType;
  province_id: AddressBookSelectId;
  district_id: AddressBookSelectId;
  ward_id: AddressBookSelectId;
  address_line: string;
  is_default: boolean;
}

// Empty address_type represents an untouched Select in the UI only.
export type AddressBookFormInputValues = Omit<
  AddressBookFormValues,
  "address_type"
> & {
  address_type: AddressType | "";
};

export type AddressBookFormMode =
  | { mode: "create" }
  | { mode: "edit"; public_id: string };

export type AddressBookTypeFilter = AddressType | "all";

export type AddressBookDataSource = "mock" | "api";
