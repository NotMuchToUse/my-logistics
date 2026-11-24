import { z } from "zod";
import type {
  District,
  Province,
  RateCalculatorFormValues,
} from "../types/rate-calculator.types";

type ProvinceField = "originProvinceId" | "destinationProvinceId";
type DistrictField = "originDistrictId" | "destinationDistrictId";

function positiveNumberField(label: string, integer = false) {
  const numberSchema = z
    .number({
      error: (issue) =>
        issue.input === undefined
          ? `Vui lòng nhập ${label}.`
          : `${label} phải là số hợp lệ.`,
    })
    .finite(`${label} phải là số hợp lệ.`)
    .positive(`${label} phải lớn hơn 0.`);

  const validatedNumber = integer
    ? numberSchema.int(`${label} phải là số nguyên.`)
    : numberSchema;

  return z.preprocess((value: unknown) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();

    if (trimmedValue.length === 0) {
      return undefined;
    }

    const numericValue = Number(trimmedValue);
    return Number.isNaN(numericValue) ? value : numericValue;
  }, validatedNumber);
}

export function createRateCalculatorSchema(
  provinces: readonly Province[],
  districts: readonly District[],
) {
  const schema = z
    .object({
      originProvinceId: positiveNumberField(
        "Tỉnh/Thành phố gửi",
        true,
      ),
      originDistrictId: positiveNumberField("Quận/Huyện gửi", true),
      destinationProvinceId: positiveNumberField(
        "Tỉnh/Thành phố nhận",
        true,
      ),
      destinationDistrictId: positiveNumberField("Quận/Huyện nhận", true),
      actualWeightGram: positiveNumberField("Trọng lượng thực"),
      lengthCm: positiveNumberField("Chiều dài"),
      widthCm: positiveNumberField("Chiều rộng"),
      heightCm: positiveNumberField("Chiều cao"),
      serviceTypeId: positiveNumberField("Dịch vụ vận chuyển", true),
      valueAddedServiceIds: z
        .array(positiveNumberField("Dịch vụ giá trị gia tăng", true))
        .default([]),
    })
    .superRefine((values, context) => {
      function validateAddress(
        provinceId: number,
        districtId: number,
        provinceField: ProvinceField,
        districtField: DistrictField,
      ): void {
        const provinceExists = provinces.some(
          (province) => province.id === provinceId && province.is_active === 1,
        );

        if (!provinceExists) {
          context.addIssue({
            code: "custom",
            path: [provinceField],
            message: "Vui lòng chọn Tỉnh/Thành phố hợp lệ.",
          });
        }

        const district = districts.find(
          (item) => item.id === districtId && item.is_active === 1,
        );

        if (!district) {
          context.addIssue({
            code: "custom",
            path: [districtField],
            message: "Vui lòng chọn Quận/Huyện hợp lệ.",
          });
          return;
        }

        if (district.province_id !== provinceId) {
          context.addIssue({
            code: "custom",
            path: [districtField],
            message: "Quận/Huyện không thuộc Tỉnh/Thành phố đã chọn.",
          });
        }
      }

      validateAddress(
        values.originProvinceId,
        values.originDistrictId,
        "originProvinceId",
        "originDistrictId",
      );
      validateAddress(
        values.destinationProvinceId,
        values.destinationDistrictId,
        "destinationProvinceId",
        "destinationDistrictId",
      );
    });

  return schema satisfies z.ZodType<RateCalculatorFormValues>;
}
