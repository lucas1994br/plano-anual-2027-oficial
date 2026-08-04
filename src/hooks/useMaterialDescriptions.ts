import { useQuery } from "@tanstack/react-query";

export function useMaterialDescriptions() {
  const { data: descriptions = {}, isLoading, error } = useQuery<Record<string, string>>({
    queryKey: ["materialDescriptions"],
    queryFn: async () => {
      const response = await fetch("/data/materialDescriptionByCode.json");
      if (!response.ok) {
        throw new Error("Failed to fetch material descriptions");
      }
      return response.json();
    },
    staleTime: Infinity, // The dictionary is static and doesn't need refetching
    gcTime: Infinity, // Keep in cache indefinitely
  });

  return { descriptions, isLoading, error };
}
