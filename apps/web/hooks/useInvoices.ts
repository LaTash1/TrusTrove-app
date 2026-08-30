import { useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInvoices,
  getInvoiceByID,
  createInvoice,
  PaginatedInvoices,
} from "@/lib/api";
import { useWalletStore } from "@/store/wallet";
import { showSuccessToast } from "@/lib/toast";
import { createErrorHandler } from "@/lib/errors";
import { useTokenAllowance } from "./useTokenAllowance";
import type { AssetType } from "@/types";
import type { InvoiceClient, PoolClient } from "@trusttrove/sdk";

const { handleMutationError } = createErrorHandler("useInvoices");

const invoiceContractID = process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID || "";
const poolContractID = process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || "";

function invalidateInvoiceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  address?: string | null,
) {
  queryClient.invalidateQueries({ queryKey: ["invoices"] });
  queryClient.invalidateQueries({ queryKey: ["poolStats"] });
  if (address) {
    queryClient.invalidateQueries({ queryKey: ["lpPosition", address] });
  }
}

export function useInvoicesList(filters?: {
  status?: string;
  issuer?: string;
  page?: number;
  limit?: number;
}) {
  const invoicesQuery = useQuery<PaginatedInvoices>({
    queryKey: ["invoices", filters],
    queryFn: () => getInvoices(filters),
    refetchInterval: 15000,
    staleTime: 15000,
  });

  return {
    invoices: invoicesQuery.data?.data ?? [],
    total: invoicesQuery.data?.total ?? 0,
    totalPages: invoicesQuery.data?.totalPages ?? 1,
    page: invoicesQuery.data?.page ?? filters?.page ?? 1,
    limit: invoicesQuery.data?.limit ?? filters?.limit ?? 20,
    isLoading: invoicesQuery.isLoading,
    error: invoicesQuery.error,
    refetch: invoicesQuery.refetch,
  };
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      buyer,
      faceValue,
      dueDate,
      asset,
    }: {
      buyer: string;
      faceValue: string;
      dueDate: number;
      asset?: AssetType;
    }) => {
      return createInvoice(buyer, faceValue, dueDate, asset);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      showSuccessToast("Invoice Created");
    },
    onError: (error) => {
      handleMutationError(error, "Invoice Creation Failed");
    },
  });

  return {
    createInvoice: mutation.mutateAsync,
    isCreating: mutation.isPending,
    createError: mutation.error,
  };
}

export function useListInvoice() {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();
  const invoiceClientRef = useRef<InvoiceClient | null>(null);

  const getInvoiceClient = useCallback(async () => {
    if (!invoiceClientRef.current) {
      const { InvoiceClient } = await import("@trusttrove/sdk");
      invoiceClientRef.current = new InvoiceClient(invoiceContractID);
    }
    return invoiceClientRef.current;
  }, []);

  const mutation = useMutation({
    mutationFn: async ({
      invoiceId,
      discountBps,
    }: {
      invoiceId: string;
      discountBps: number;
    }) => {
      if (!address) throw new Error("Wallet not connected");
      const client = await getInvoiceClient();
      return client.listForFinancing(invoiceId, discountBps, address);
    },
    onSuccess: () => {
      invalidateInvoiceQueries(queryClient, address);
      showSuccessToast("Invoice Listed for Financing");
    },
    onError: (error) => {
      handleMutationError(error, "Listing Failed");
    },
  });

  return {
    listInvoice: mutation.mutateAsync,
    isListing: mutation.isPending,
    listError: mutation.error,
  };
}

export function useFundInvoice() {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();
  const poolClientRef = useRef<PoolClient | null>(null);

  const getPoolClient = useCallback(async () => {
    if (!poolClientRef.current) {
      const { PoolClient } = await import("@trusttrove/sdk");
      poolClientRef.current = new PoolClient(poolContractID);
    }
    return poolClientRef.current;
  }, []);

  const mutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error("Wallet not connected");
      const client = await getPoolClient();
      return client.fundInvoice(invoiceId, address);
    },
    onSuccess: () => {
      invalidateInvoiceQueries(queryClient, address);
      showSuccessToast("Invoice Funded");
    },
    onError: (error) => {
      handleMutationError(error, "Funding Failed");
    },
  });

  return {
    fundInvoice: mutation.mutateAsync,
    isFunding: mutation.isPending,
    fundError: mutation.error,
  };
}

export function useShipInvoice() {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();
  const invoiceClientRef = useRef<InvoiceClient | null>(null);

  const getInvoiceClient = useCallback(async () => {
    if (!invoiceClientRef.current) {
      const { InvoiceClient } = await import("@trusttrove/sdk");
      invoiceClientRef.current = new InvoiceClient(invoiceContractID);
    }
    return invoiceClientRef.current;
  }, []);

  const mutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error("Wallet not connected");
      const client = await getInvoiceClient();
      return client.markShipped(invoiceId, address);
    },
    onSuccess: () => {
      invalidateInvoiceQueries(queryClient, address);
      showSuccessToast("Invoice Shipped");
    },
    onError: (error) => {
      handleMutationError(error, "Shipping Failed");
    },
  });

  return {
    shipInvoice: mutation.mutateAsync,
    isShipping: mutation.isPending,
    shipError: mutation.error,
  };
}

export function useConfirmDelivery() {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();
  const invoiceClientRef = useRef<InvoiceClient | null>(null);

  const getInvoiceClient = useCallback(async () => {
    if (!invoiceClientRef.current) {
      const { InvoiceClient } = await import("@trusttrove/sdk");
      invoiceClientRef.current = new InvoiceClient(invoiceContractID);
    }
    return invoiceClientRef.current;
  }, []);

  const mutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error("Wallet not connected");
      const invoice = await getInvoiceByID(invoiceId);
      const client = await getInvoiceClient();
      return client.confirmDelivery(invoiceId, invoice.buyer, address);
    },
    onSuccess: () => {
      invalidateInvoiceQueries(queryClient, address);
      showSuccessToast("Delivery Confirmed");
    },
    onError: (error) => {
      handleMutationError(error, "Confirmation Failed");
    },
  });

  return {
    confirmDelivery: mutation.mutateAsync,
    isConfirming: mutation.isPending,
    confirmError: mutation.error,
  };
}

export function useRepayInvoice() {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();
  const { ensureAllowance } = useTokenAllowance();
  const invoiceClientRef = useRef<InvoiceClient | null>(null);

  const getInvoiceClient = useCallback(async () => {
    if (!invoiceClientRef.current) {
      const { InvoiceClient } = await import("@trusttrove/sdk");
      invoiceClientRef.current = new InvoiceClient(invoiceContractID);
    }
    return invoiceClientRef.current;
  }, []);

  const mutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error("Wallet not connected");
      const client = await getInvoiceClient();
      const invoice = await client.get(invoiceId, address);
      try {
        await ensureAllowance(invoiceContractID, invoice.faceValue);
      } catch (allowanceErr: unknown) {
        const message =
          allowanceErr instanceof Error ? allowanceErr.message : "";
        if (
          message.toLowerCase().includes("user rejected") ||
          message.toLowerCase().includes("rejected") ||
          message.toLowerCase().includes("user denied") ||
          message.toLowerCase().includes("canceled")
        ) {
          throw new Error("Allowance rejected");
        }
        throw allowanceErr;
      }
      return client.repay(invoiceId, address);
    },
    onSuccess: () => {
      invalidateInvoiceQueries(queryClient, address);
      showSuccessToast("Invoice Repaid");
    },
    onError: (error) => {
      handleMutationError(error, "Repayment Failed");
    },
  });

  return {
    repayInvoice: mutation.mutateAsync,
    isRepaying: mutation.isPending,
    repayError: mutation.error,
  };
}

export function useDefaultInvoice() {
  const queryClient = useQueryClient();
  const { address } = useWalletStore();
  const invoiceClientRef = useRef<InvoiceClient | null>(null);

  const getInvoiceClient = useCallback(async () => {
    if (!invoiceClientRef.current) {
      const { InvoiceClient } = await import("@trusttrove/sdk");
      invoiceClientRef.current = new InvoiceClient(invoiceContractID);
    }
    return invoiceClientRef.current;
  }, []);

  const mutation = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!address) throw new Error("Wallet not connected");
      const client = await getInvoiceClient();
      return client.triggerDefault(invoiceId, address);
    },
    onSuccess: () => {
      invalidateInvoiceQueries(queryClient, address);
      showSuccessToast("Invoice Defaulted");
    },
    onError: (error) => {
      handleMutationError(error, "Default Action Failed");
    },
  });

  return {
    defaultInvoice: mutation.mutateAsync,
    isDefaulting: mutation.isPending,
    defaultError: mutation.error,
  };
}

/**
 * Custom hook for managing invoice lifecycle operations on the TrusTrove platform.
 *
 * This is kept as a compatibility aggregate around the per-action hooks so
 * existing pages and tests continue to receive the original combined surface.
 */
export function useInvoices(filters?: {
  status?: string;
  issuer?: string;
  page?: number;
  limit?: number;
}) {
  const list = useInvoicesList(filters);
  const create = useCreateInvoice();
  const listInvoice = useListInvoice();
  const fund = useFundInvoice();
  const ship = useShipInvoice();
  const confirm = useConfirmDelivery();
  const repay = useRepayInvoice();
  const defaultInvoice = useDefaultInvoice();

  return {
    ...list,
    createInvoice: create.createInvoice,
    isCreating: create.isCreating,
    createError: create.createError,
    listInvoice: listInvoice.listInvoice,
    isListing: listInvoice.isListing,
    listError: listInvoice.listError,
    fundInvoice: fund.fundInvoice,
    isFunding: fund.isFunding,
    fundError: fund.fundError,
    shipInvoice: ship.shipInvoice,
    isShipping: ship.isShipping,
    shipError: ship.shipError,
    confirmDelivery: confirm.confirmDelivery,
    isConfirming: confirm.isConfirming,
    confirmError: confirm.confirmError,
    repayInvoice: repay.repayInvoice,
    isRepaying: repay.isRepaying,
    repayError: repay.repayError,
    defaultInvoice: defaultInvoice.defaultInvoice,
    isDefaulting: defaultInvoice.isDefaulting,
    defaultError: defaultInvoice.defaultError,
  };
}

/**
 * Custom hook for fetching a single invoice by its ID.
 *
 * @param id - The unique identifier of the invoice to fetch. The query is
 *   skipped (disabled) when `id` is an empty string.
 */
export function useInvoice(id: string) {
  const invoiceQuery = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => getInvoiceByID(id),
    enabled: !!id,
    staleTime: 60000,
  });

  return {
    invoice: invoiceQuery.data,
    isLoading: invoiceQuery.isLoading,
    error: invoiceQuery.error,
    refetch: invoiceQuery.refetch,
  };
}
