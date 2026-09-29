import { eq } from "drizzle-orm";
import { db, evolutionInstanceSettingsTable } from "@workspace/db";
import { createEvolutionInstanceStore } from "./evolution-instance-store";

const EVOLUTION_INSTANCE_SETTINGS_ID = 1;

export const evolutionInstanceStore = createEvolutionInstanceStore({
  legacyInstance: process.env["EVOLUTION_INSTANCE"],
  repository: {
    async load() {
      const [settings] = await db
        .select({ instanceName: evolutionInstanceSettingsTable.instanceName })
        .from(evolutionInstanceSettingsTable)
        .where(eq(evolutionInstanceSettingsTable.id, EVOLUTION_INSTANCE_SETTINGS_ID))
        .limit(1);
      return settings ?? null;
    },
    async save(instanceName) {
      await db
        .insert(evolutionInstanceSettingsTable)
        .values({ id: EVOLUTION_INSTANCE_SETTINGS_ID, instanceName })
        .onConflictDoUpdate({
          target: evolutionInstanceSettingsTable.id,
          set: { instanceName, updatedAt: new Date() },
        });
    },
  },
});