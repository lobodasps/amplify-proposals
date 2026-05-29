import React, { createContext, useContext, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "./AuthContext";

interface Entity {
  id: string;
  name: string;
  shortName?: string | null;
  badgeColor?: string | null;
  supabaseCompanyId?: string | null;
  isDefault?: boolean | null;
}

interface EntityContextValue {
  activeEntity: Entity | null;
  activeEntityId: string | null;
  setActiveEntityId: (id: string) => void;
  allowedEntities: Entity[];
  hasMultipleEntities: boolean;
}

const EntityContext = createContext<EntityContextValue>({
  activeEntity: null,
  activeEntityId: null,
  setActiveEntityId: () => {},
  allowedEntities: [],
  hasMultipleEntities: false,
});

export function EntityProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  // Only query entities when authenticated — prevents 401 on initial load
  const { data: entities = [] } = trpc.entities.list.useQuery(undefined, {
    enabled: isAuthenticated && !loading,
  });
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);

  // Auto-select default entity or first entity
  useEffect(() => {
    if (entities.length > 0 && activeEntityId === null) {
      const defaultEntity = (entities as any[]).find((e: any) => e.isDefault) ?? entities[0];
      setActiveEntityId((defaultEntity as any).id);
    }
  }, [entities, activeEntityId]);

  const activeEntity = entities.find(e => e.id === activeEntityId) ?? null;

  return (
    <EntityContext.Provider value={{
      activeEntity,
      activeEntityId,
      setActiveEntityId,
      allowedEntities: entities,
      hasMultipleEntities: entities.length > 1,
    }}>
      {children}
    </EntityContext.Provider>
  );
}

export function useEntityContext() {
  return useContext(EntityContext);
}
