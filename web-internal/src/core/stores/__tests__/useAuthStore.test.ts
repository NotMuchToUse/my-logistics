import { afterEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../useAuthStore";
import { hasShipmentPermission } from "@/features/shipment-list/hooks/shipment-list.hook-logic";

describe("useAuthStore permission checks", () => {
  afterEach(() => {
    useAuthStore.setState({ permissions: [] });
  });

  it("treats the wildcard permission as access to every permission", () => {
    useAuthStore.setState({ permissions: ["*"] });

    expect(useAuthStore.getState().hasPermission("users.assign_role")).toBe(
      true,
    );
    expect(useAuthStore.getState().hasPermission("system.read_errors")).toBe(
      true,
    );
  });

  it("keeps explicitly granted permissions scoped when wildcard is absent", () => {
    useAuthStore.setState({ permissions: ["shipment.read"] });

    expect(useAuthStore.getState().hasPermission("shipment.read")).toBe(true);
    expect(useAuthStore.getState().hasPermission("users.assign_role")).toBe(
      false,
    );
  });

  it("allows a wildcard administrator to read and operate shipments", () => {
    expect(hasShipmentPermission(["*"], "read")).toBe(true);
    expect(hasShipmentPermission(["*"], "priority")).toBe(true);
    expect(hasShipmentPermission(["*"], "cancel")).toBe(true);
  });
});
