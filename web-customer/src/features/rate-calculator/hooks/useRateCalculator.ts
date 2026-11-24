import { useCallback, useEffect, useRef, useState } from "react";
import {
  calculateRate,
  getRateCalculatorDistricts,
  getRateCalculatorProvinces,
  getRateCalculatorServiceTypes,
  getRateCalculatorValueAddedServices,
  getRateCalculatorWeightConversionRules,
  type MockRateCalculationOutcome,
} from "../api/rate-calculator.api";
import { createRateCalculatorSchema } from "../schemas/rate-calculator.schema";
import type {
  District,
  Province,
  RateCalculatorFormValues,
  ServiceType,
  ValueAddedService,
  WeightConversionRule,
} from "../types/rate-calculator.types";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof error.error === "object" &&
    error.error !== null &&
    "message" in error.error &&
    typeof error.error.message === "string"
  ) {
    return error.error.message;
  }

  return "Không thể tải dữ liệu hoặc tính cước. Vui lòng thử lại.";
}

function fetchRateCalculatorCatalogs() {
  return Promise.all([
    getRateCalculatorProvinces(),
    getRateCalculatorServiceTypes(),
    getRateCalculatorValueAddedServices(),
    getRateCalculatorWeightConversionRules(),
  ]);
}

export function useRateCalculator() {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [originDistricts, setOriginDistricts] = useState<District[]>([]);
  const [destinationDistricts, setDestinationDistricts] = useState<District[]>(
    [],
  );
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [valueAddedServices, setValueAddedServices] = useState<
    ValueAddedService[]
  >([]);
  const [weightConversionRules, setWeightConversionRules] = useState<
    WeightConversionRule[]
  >([]);
  const [result, setResult] = useState<MockRateCalculationOutcome | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);
  const [isLoadingOriginDistricts, setIsLoadingOriginDistricts] =
    useState(false);
  const [isLoadingDestinationDistricts, setIsLoadingDestinationDistricts] =
    useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  const catalogRequestId = useRef(0);
  const originDistrictRequestId = useRef(0);
  const destinationDistrictRequestId = useRef(0);
  const calculationRequestId = useRef(0);
  const isSubmitting = useRef(false);

  const invalidateResult = useCallback(() => {
    calculationRequestId.current += 1;
    isSubmitting.current = false;
    setResult(null);
    setCalculationError(null);
    setIsCalculating(false);
  }, []);

  const loadCatalogs = useCallback(async (): Promise<void> => {
    const requestId = ++catalogRequestId.current;
    setIsLoadingCatalogs(true);
    setCatalogError(null);

    try {
      const [
        loadedProvinces,
        loadedServiceTypes,
        loadedValueAddedServices,
        loadedWeightConversionRules,
      ] = await fetchRateCalculatorCatalogs();

      if (requestId !== catalogRequestId.current) {
        return;
      }

      setProvinces(loadedProvinces);
      setServiceTypes(loadedServiceTypes);
      setValueAddedServices(loadedValueAddedServices);
      setWeightConversionRules(loadedWeightConversionRules);
    } catch (error: unknown) {
      if (requestId === catalogRequestId.current) {
        setCatalogError(getErrorMessage(error));
      }
    } finally {
      if (requestId === catalogRequestId.current) {
        setIsLoadingCatalogs(false);
      }
    }
  }, []);

  useEffect(() => {
    const requestId = ++catalogRequestId.current;
    let isActive = true;

    async function loadInitialCatalogs(): Promise<void> {
      try {
        const [
          loadedProvinces,
          loadedServiceTypes,
          loadedValueAddedServices,
          loadedWeightConversionRules,
        ] = await fetchRateCalculatorCatalogs();

        if (!isActive || requestId !== catalogRequestId.current) {
          return;
        }

        setProvinces(loadedProvinces);
        setServiceTypes(loadedServiceTypes);
        setValueAddedServices(loadedValueAddedServices);
        setWeightConversionRules(loadedWeightConversionRules);
      } catch (error: unknown) {
        if (isActive && requestId === catalogRequestId.current) {
          setCatalogError(getErrorMessage(error));
        }
      } finally {
        if (isActive && requestId === catalogRequestId.current) {
          setIsLoadingCatalogs(false);
        }
      }
    }

    void loadInitialCatalogs();

    return () => {
      isActive = false;
      catalogRequestId.current += 1;
    };
  }, []);

  const handleOriginProvinceChange = useCallback(
    async (
      provinceId: number | null,
      clearDistrictSelection: () => void,
    ): Promise<void> => {
      clearDistrictSelection();
      invalidateResult();
      setCatalogError(null);
      setOriginDistricts([]);

      const requestId = ++originDistrictRequestId.current;

      if (provinceId === null || provinceId <= 0) {
        setIsLoadingOriginDistricts(false);
        return;
      }

      setIsLoadingOriginDistricts(true);

      try {
        const districts = await getRateCalculatorDistricts(provinceId);

        if (requestId === originDistrictRequestId.current) {
          setOriginDistricts(districts);
        }
      } catch (error: unknown) {
        if (requestId === originDistrictRequestId.current) {
          setCatalogError(getErrorMessage(error));
        }
      } finally {
        if (requestId === originDistrictRequestId.current) {
          setIsLoadingOriginDistricts(false);
        }
      }
    },
    [invalidateResult],
  );

  const handleDestinationProvinceChange = useCallback(
    async (
      provinceId: number | null,
      clearDistrictSelection: () => void,
    ): Promise<void> => {
      clearDistrictSelection();
      invalidateResult();
      setCatalogError(null);
      setDestinationDistricts([]);

      const requestId = ++destinationDistrictRequestId.current;

      if (provinceId === null || provinceId <= 0) {
        setIsLoadingDestinationDistricts(false);
        return;
      }

      setIsLoadingDestinationDistricts(true);

      try {
        const districts = await getRateCalculatorDistricts(provinceId);

        if (requestId === destinationDistrictRequestId.current) {
          setDestinationDistricts(districts);
        }
      } catch (error: unknown) {
        if (requestId === destinationDistrictRequestId.current) {
          setCatalogError(getErrorMessage(error));
        }
      } finally {
        if (requestId === destinationDistrictRequestId.current) {
          setIsLoadingDestinationDistricts(false);
        }
      }
    },
    [invalidateResult],
  );

  async function submitRateCalculation(
    formValues: RateCalculatorFormValues,
  ): Promise<void> {
    if (
      isSubmitting.current ||
      isLoadingCatalogs ||
      catalogError !== null
    ) {
      return;
    }

    isSubmitting.current = true;
    const requestId = ++calculationRequestId.current;
    setIsCalculating(true);
    setCalculationError(null);
    setResult(null);

    const schema = createRateCalculatorSchema(provinces, [
      ...originDistricts,
      ...destinationDistricts,
    ]);
    const validation = schema.safeParse(formValues);

    if (!validation.success) {
      setCalculationError(
        validation.error.issues[0]?.message ??
          "Vui lòng kiểm tra lại thông tin vận chuyển.",
      );
      isSubmitting.current = false;
      setIsCalculating(false);
      return;
    }

    try {
      const calculation = await calculateRate(validation.data);

      if (requestId === calculationRequestId.current) {
        setResult(calculation);
      }
    } catch (error: unknown) {
      if (requestId === calculationRequestId.current) {
        setCalculationError(getErrorMessage(error));
      }
    } finally {
      if (requestId === calculationRequestId.current) {
        isSubmitting.current = false;
        setIsCalculating(false);
      }
    }
  }

  function resetCalculator(resetForm: () => void): void {
    invalidateResult();
    originDistrictRequestId.current += 1;
    destinationDistrictRequestId.current += 1;
    setOriginDistricts([]);
    setDestinationDistricts([]);
    setIsLoadingOriginDistricts(false);
    setIsLoadingDestinationDistricts(false);
    setCatalogError(null);
    resetForm();
  }

  const error = catalogError ?? calculationError;
  const isLoading =
    isLoadingCatalogs ||
    isLoadingOriginDistricts ||
    isLoadingDestinationDistricts ||
    isCalculating;
  const isEmpty = !isLoading && result === null;
  const isCatalogEmpty =
    !isLoadingCatalogs &&
    (provinces.length === 0 || serviceTypes.length === 0);

  return {
    provinces,
    originDistricts,
    destinationDistricts,
    serviceTypes,
    valueAddedServices,
    weightConversionRules,
    result,
    error,
    isLoading,
    isLoadingCatalogs,
    isLoadingOriginDistricts,
    isLoadingDestinationDistricts,
    isCalculating,
    isEmpty,
    isCatalogEmpty,
    loadCatalogs,
    handleOriginProvinceChange,
    handleDestinationProvinceChange,
    submitRateCalculation,
    invalidateResult,
    resetCalculator,
  };
}
