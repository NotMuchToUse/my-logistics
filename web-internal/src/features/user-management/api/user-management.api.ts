import { toast } from "sonner";
import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import type {
  ApiPaginationResponse,
  ApiSuccessResponse,
} from "@/types/api.types";
import type {
  Customer,
  CustomerInput,
  EmployeeInput,
  EmployeeUser,
  UserStatus,
} from "../types/user-management.types";

const mockUsers: EmployeeUser[] = [
  {
    public_id: "01JDC9X8K2M4N6P8Q0R2S4T6W0",
    employee_code: "VST0001",
    full_name: "Nguyễn Minh Anh",
    email: "minhanh@vietstar.vn",
    phone_masked: "090****123",
    status: "active",
    is_active: 1,
    user_has_roles: ["system_admin"],
    user_branch_scopes: [
      {
        branch_id: 1,
        warehouse_id: null,
        scope_type: "hq_all",
        can_view: true,
        can_operate: true,
        can_approve: true,
      },
    ],
  },
  {
    public_id: "01JDC9X8K2M4N6P8Q0R2S4T6W1",
    employee_code: "VST0002",
    full_name: "Trần Quốc Bảo",
    email: "quocbao@vietstar.vn",
    phone_masked: "091****456",
    status: "active",
    is_active: 1,
    user_has_roles: ["branch_manager", "coordinator"],
    user_branch_scopes: [
      {
        branch_id: 3,
        warehouse_id: null,
        scope_type: "branch",
        can_view: true,
        can_operate: true,
        can_approve: true,
      },
    ],
  },
  {
    public_id: "01JDC9X8K2M4N6P8Q0R2S4T6W2",
    employee_code: "VST0003",
    full_name: "Lê Thu Hà",
    email: "thuha@vietstar.vn",
    phone_masked: "098****789",
    status: "suspended",
    is_active: 0,
    user_has_roles: ["warehouse_staff"],
    user_branch_scopes: [
      {
        branch_id: 2,
        warehouse_id: 1,
        scope_type: "warehouse",
        can_view: true,
        can_operate: true,
        can_approve: false,
      },
    ],
  },
];

const mockCustomers: Customer[] = [
  {
    public_id: "01JDC9X8K2M4N6P8Q0R2S4T6X0",
    customer_code: "CUS00001",
    customer_type: "individual",
    full_name: "Phạm Ngọc Mai",
    company_name: null,
    tax_code: null,
    credit_limit: null,
    email: "ngocmai@example.com",
    phone_masked: "093****010",
    status: "active",
  },
  {
    public_id: "01JDC9X8K2M4N6P8Q0R2S4T6X1",
    customer_code: "CUS00002",
    customer_type: "corporate_postpaid",
    full_name: "Đỗ Hoàng Nam",
    company_name: "Công ty TNHH Giao thương Á Châu",
    tax_code: "0312345678",
    credit_limit: 100_000_000,
    email: "nam@asia-trade.vn",
    phone_masked: "090****345",
    status: "active",
  },
  {
    public_id: "01JDC9X8K2M4N6P8Q0R2S4T6X2",
    customer_code: "CUS00003",
    customer_type: "corporate_postpaid",
    full_name: "Vũ Thanh Tâm",
    company_name: "Công ty Cổ phần Thực phẩm Xanh",
    tax_code: "0109876543",
    credit_limit: 250_000_000,
    email: "tam@thucphamxanh.vn",
    phone_masked: "097****678",
    status: "active",
  },
];

let nextMockUserId = 4;
let nextMockCustomerId = 4;

async function runWithDevMock<T>(
  entity: string,
  mockOperation: () => T,
  apiOperation: () => Promise<T>,
): Promise<T> {
  if (USE_MOCK) {
    return mockOperation();
  }

  if (!import.meta.env.DEV) {
    return apiOperation();
  }

  try {
    return await apiOperation();
  } catch (error) {
    console.warn(`Không gọi được API ${entity}; chuyển sang dữ liệu mẫu dev.`, error);
    toast.warning(`Không kết nối được API ${entity}; đang dùng dữ liệu mẫu trên máy.`);
    return mockOperation();
  }
}

function cloneEmployee(employee: EmployeeUser): EmployeeUser {
  return {
    ...employee,
    user_has_roles: [...employee.user_has_roles],
    user_branch_scopes: employee.user_branch_scopes.map((scope) => ({
      ...scope,
    })),
  };
}

function normalizeEmployee(employee: EmployeeUser): EmployeeUser {
  return {
    ...employee,
    status:
      employee.status ??
      (employee.is_active === false || employee.is_active === 0
        ? "inactive"
        : "active"),
  };
}

function cloneCustomer(customer: Customer): Customer {
  return { ...customer };
}

export function getUsers(): Promise<EmployeeUser[]> {
  return runWithDevMock(
    "nhân viên",
    () => mockUsers.map(cloneEmployee),
    async () => {
      const response = await axiosClient.get<ApiPaginationResponse<EmployeeUser>>(
        "/api/v1/admin/users",
        { params: { user_type: "staff", page: 1, per_page: 100 } },
      );
      return response.data.data.map(normalizeEmployee);
    },
  );
}

export function createUser(input: EmployeeInput): Promise<EmployeeUser> {
  return runWithDevMock(
    "nhân viên",
    () => {
      const user: EmployeeUser = {
        ...input,
        public_id: `MOCK-USER-${nextMockUserId++}`,
        phone_masked: input.phone,
        status: "active",
        is_active: 1,
      };
      mockUsers.push(user);
      return cloneEmployee(user);
    },
    async () => {
      const response = await axiosClient.post<ApiSuccessResponse<EmployeeUser>>(
        "/api/v1/admin/users",
        input,
      );
      return normalizeEmployee(response.data.data);
    },
  );
}

export function updateUser(
  publicId: string,
  input: Partial<EmployeeInput> & {
    status?: UserStatus;
    is_active?: boolean | 0 | 1;
  },
): Promise<EmployeeUser> {
  return runWithDevMock(
    "nhân viên",
    () => {
      const index = mockUsers.findIndex((user) => user.public_id === publicId);
      if (index < 0) {
        throw new Error(`Không tìm thấy nhân viên ${publicId}.`);
      }
      const user = mockUsers[index];
      if (!user) {
        throw new Error(`Không tìm thấy nhân viên ${publicId}.`);
      }
      mockUsers[index] = {
        ...user,
        ...input,
        phone_masked: input.phone ?? user.phone_masked,
        is_active:
          input.is_active ??
          (input.status === "active"
            ? 1
            : input.status
              ? 0
              : user.is_active),
      };
      return cloneEmployee(mockUsers[index]!);
    },
    async () => {
      const response = await axiosClient.patch<ApiSuccessResponse<EmployeeUser>>(
        `/api/v1/admin/users/${encodeURIComponent(publicId)}`,
        input,
      );
      return normalizeEmployee(response.data.data);
    },
  );
}

export function deleteUser(publicId: string): Promise<void> {
  return runWithDevMock(
    "nhân viên",
    () => {
      const index = mockUsers.findIndex((user) => user.public_id === publicId);
      if (index < 0) {
        throw new Error(`Không tìm thấy nhân viên ${publicId}.`);
      }
      mockUsers.splice(index, 1);
    },
    async () => {
      await axiosClient.delete<ApiSuccessResponse<null>>(
        `/api/v1/admin/users/${encodeURIComponent(publicId)}`,
      );
    },
  );
}

export function getCustomers(): Promise<Customer[]> {
  return runWithDevMock(
    "khách hàng",
    () => mockCustomers.map(cloneCustomer),
    async () => {
      const response = await axiosClient.get<ApiPaginationResponse<Customer>>(
        "/api/v1/admin/customers",
        { params: { page: 1, per_page: 100 } },
      );
      return response.data.data;
    },
  );
}

export function createCustomer(input: CustomerInput): Promise<Customer> {
  return runWithDevMock(
    "khách hàng",
    () => {
      const customer: Customer = {
        ...input,
        public_id: `MOCK-CUSTOMER-${nextMockCustomerId++}`,
      };
      mockCustomers.push(customer);
      return cloneCustomer(customer);
    },
    async () => {
      const response = await axiosClient.post<ApiSuccessResponse<Customer>>(
        "/api/v1/admin/customers",
        input,
      );
      return response.data.data;
    },
  );
}

export function updateCustomer(
  publicId: string,
  input: Partial<CustomerInput>,
): Promise<Customer> {
  return runWithDevMock(
    "khách hàng",
    () => {
      const index = mockCustomers.findIndex(
        (customer) => customer.public_id === publicId,
      );
      if (index < 0) {
        throw new Error(`Không tìm thấy khách hàng ${publicId}.`);
      }
      const customer = mockCustomers[index];
      if (!customer) {
        throw new Error(`Không tìm thấy khách hàng ${publicId}.`);
      }
      mockCustomers[index] = { ...customer, ...input };
      return cloneCustomer(mockCustomers[index]!);
    },
    async () => {
      const response = await axiosClient.patch<ApiSuccessResponse<Customer>>(
        `/api/v1/admin/customers/${encodeURIComponent(publicId)}`,
        input,
      );
      return response.data.data;
    },
  );
}

export function deleteCustomer(publicId: string): Promise<void> {
  return runWithDevMock(
    "khách hàng",
    () => {
      const index = mockCustomers.findIndex(
        (customer) => customer.public_id === publicId,
      );
      if (index < 0) {
        throw new Error(`Không tìm thấy khách hàng ${publicId}.`);
      }
      mockCustomers.splice(index, 1);
    },
    async () => {
      await axiosClient.delete<ApiSuccessResponse<null>>(
        `/api/v1/admin/customers/${encodeURIComponent(publicId)}`,
      );
    },
  );
}
